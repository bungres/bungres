import { join, resolve } from "node:path";
import { readdirSync, existsSync, statSync } from "node:fs";
import { generateCreateTable, generateCreateView, inlineParams } from "@bungres/orm";
import type { TableConfig } from "@bungres/orm";
import type { ResolvedConfig } from "../config.js";
import { loadSchemas, type SchemaEntry } from "../schema-loader.js";
import { diffSchemas, type SchemaSnapshot } from "../differ.js";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// generate — diff-based SQL migration generator (drizzle-style numbering)
//
// Generates a single .sql file with `-- ==== UP ====` and `-- ==== DOWN ====`
// Schema state is tracked in <migrationsDir>/meta/*_snapshot.json
// ---------------------------------------------------------------------------

export async function runGenerate(
  config: ResolvedConfig,
  name?: string
): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit generate ")));
  const s = p.spinner();
  s.start("Loading schemas...");

  const schemas = await loadSchemas(config.schema);

  if (schemas.length === 0) {
    s.stop("No table definitions found.");
    p.log.warn(pc.yellow("Check your schema glob pattern."));
    p.outro("Failed.");
    return;
  }
  s.stop(`Loaded ${schemas.length} schemas.`);

  const migrationsDir = resolve(config.out);

  if (existsSync(migrationsDir) && !statSync(migrationsDir).isDirectory()) {
    s.stop("Failed.");
    p.log.error(pc.red(`Migration path exists but is not a directory: ${migrationsDir}`));
    p.outro("Failed.");
    return;
  }

  const metaDir = join(migrationsDir, "meta");
  await Bun.$`mkdir -p ${migrationsDir}`.quiet();
  await Bun.$`mkdir -p ${metaDir}`.quiet();

  // ── Build current snapshot from loaded schemas ────────────────────────────
  const currentSnapshot: SchemaSnapshot = { tables: {}, enums: {}, views: {} };
  for (const s of schemas) {
    if (s.type === "table") {
      currentSnapshot.tables[s.config.name] = s.config;
    } else if (s.type === "enum") {
      currentSnapshot.enums[s.enumName] = { enumName: s.enumName, enumValues: s.enumValues };
    } else if (s.type === "view") {
      currentSnapshot.views[s.config.name] = {
        name: s.config.name,
        materialized: s.config.materialized,
        sql: typeof s.config.query?.toSQL === 'function' ? inlineParams(s.config.query.toSQL()) : s.config.sql
      };
    }
  }

  // ── Load previous snapshot (if any) ──────────────────────────────────────
  let prevSnapshot: SchemaSnapshot = { tables: {}, enums: {}, views: {} };
  let isFirstMigration = true;

  try {
    const files = readdirSync(metaDir).filter(f => f.endsWith("_snapshot.json")).sort();
    if (files.length > 0) {
      const latest = files[files.length - 1] as string;
      const parsed = JSON.parse(await Bun.file(join(metaDir, latest)).text());
      if (parsed.tables || parsed.enums || parsed.views) {
        prevSnapshot = {
          tables: parsed.tables || {},
          enums: parsed.enums || {},
          views: parsed.views || {}
        };
      } else {
        prevSnapshot = { tables: parsed, enums: {}, views: {} };
      }
      isFirstMigration = false;
    } else {
      // Fallback to legacy .snapshot.json
      const legacyFile = Bun.file(join(migrationsDir, ".snapshot.json"));
      if (await legacyFile.exists()) {
        const parsed = JSON.parse(await legacyFile.text());
        if (parsed.tables || parsed.enums || parsed.views) {
          prevSnapshot = {
            tables: parsed.tables || {},
            enums: parsed.enums || {},
            views: parsed.views || {}
          };
        } else {
          prevSnapshot = { tables: parsed, enums: {}, views: {} };
        }
        isFirstMigration = false;
      }
    }
  } catch (e) {
    // ignore dir missing errors initially
  }

  // ── Determine next sequence number ───────────────────────────────────────
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const HH = String(now.getUTCHours()).padStart(2, "0");
  const MM = String(now.getUTCMinutes()).padStart(2, "0");
  const SS = String(now.getUTCSeconds()).padStart(2, "0");
  
  const prefix = `${yyyy}_${mm}_${dd}_${HH}${MM}${SS}`;
  const filename = name ? `${prefix}_${name}.sql` : `${prefix}.sql`;
  const outPath = join(migrationsDir, filename);

  // ── Diff ──────────────────────────────────────────────────────────────────
  let upStatements: string[];
  let downStatements: string[];
  let summary: string[];
  let warnings: string[] = [];

  if (isFirstMigration) {
    // First migration — full schema sorted by FK dependency order
    const tableSchemas = schemas.filter(s => s.type === "table") as any[];
    const enumSchemas = schemas.filter(s => s.type === "enum") as any[];
    const viewSchemas = schemas.filter(s => s.type === "view") as any[];
    
    const sorted = topoSort(tableSchemas);

    upStatements = [];
    downStatements = [];
    summary = [];

    // Enums first
    for (const e of enumSchemas) {
      upStatements.push(`-- ${e.exportName}`, `CREATE TYPE "${e.enumName}" AS ENUM (${e.enumValues.map((v: string) => `'${v.replace(/'/g, "''")}'`).join(", ")});`, ``);
      downStatements.unshift(`DROP TYPE IF EXISTS "${e.enumName}";`);
      summary.push(`CREATE TYPE ${e.enumName}`);
    }

    // Then tables
    for (const entry of sorted) {
      upStatements.push(`-- ${entry.exportName}`, generateCreateTable(entry.config, true), ``);
      const tbl = entry.config.schema ? `"${entry.config.schema}"."${entry.config.name}"` : `"${entry.config.name}"`;
      downStatements.unshift(`DROP TABLE IF EXISTS ${tbl};`);
      summary.push(`CREATE TABLE ${entry.config.name}`);
    }

    // Finally views
    for (const v of viewSchemas) {
      upStatements.push(`-- ${v.exportName}`, generateCreateView(v.config), ``);
      const isMat = v.config.materialized ? "MATERIALIZED VIEW" : "VIEW";
      downStatements.unshift(`DROP ${isMat} IF EXISTS "${v.config.name}";`);
      summary.push(`CREATE ${isMat} ${v.config.name}`);
    }
  } else {
    // Subsequent migrations — diff only
    const upDiff = diffSchemas(prevSnapshot, currentSnapshot);

    if (upDiff.statements.length === 0) {
      p.log.warn(pc.yellow("No schema changes detected. Nothing to generate."));
      p.outro("Done.");
      return;
    }

    upStatements = upDiff.statements;
    summary = upDiff.summary;
    warnings = upDiff.warnings;

    // Generate reverse diff for down.sql!
    const downDiff = diffSchemas(currentSnapshot, prevSnapshot);
    downStatements = downDiff.statements;
  }

  // ── Prompt for confirmation ───────────────────────────────────────────────
  p.log.message(pc.bold("Schema changes detected:"));
  for (const s of summary) {
    if (s.startsWith("CREATE") || s.startsWith("ALTER TABLE") && s.includes("ADD")) {
      p.log.success(pc.green(`  + ${s}`));
    } else if (s.startsWith("DROP") || s.startsWith("ALTER TABLE") && s.includes("DROP")) {
      p.log.error(pc.red(`  - ${s}`));
    } else {
      p.log.info(pc.blue(`  ~ ${s}`));
    }
  }

  if (warnings.length > 0) {
    p.log.warn(pc.bgRed(pc.white(" ⚠️ DATA LOSS DETECTED ")));
    for (const w of warnings) p.log.warn(pc.red(`  ! ${w}`));
  }

  const shouldGenerate = await p.confirm({
    message: "Generate this migration?",
    initialValue: true
  });

  if (p.isCancel(shouldGenerate) || !shouldGenerate) {
    p.outro(pc.gray("Generation cancelled."));
    return;
  }

  s.start("Writing files...");

  // ── Write migration file ──────────────────────────────────────────────────
  const lines: string[] = [
    `-- Migration: ${filename}`,
    `-- Generated by @bungres/kit at ${new Date().toISOString()}`,
    `-- Changes: ${summary.join(", ")}`,
    ``,
    `-- ==== UP ====`,
    ...upStatements,
    ``,
    `-- ==== DOWN ====`,
    ...downStatements,
    ``,
  ];

  await Bun.write(outPath, lines.join("\n"));

  // ── Save updated snapshot ─────────────────────────────────────────────────
  const metaPath = join(metaDir, `${prefix}_snapshot.json`);
  await Bun.write(metaPath, JSON.stringify(currentSnapshot, null, 2));

  // Clean up legacy snapshot if it exists
  const legacyFile = Bun.file(join(migrationsDir, ".snapshot.json"));
  if (await legacyFile.exists()) {
    await Bun.$`rm ${legacyFile.name}`.quiet();
  }

  s.stop(`Generated ${pc.cyan(filename)}`);
  p.outro(`Run ${pc.green("bungres migrate")} to apply it.`);
}

// ---------------------------------------------------------------------------
// Topological sort — referenced tables come before dependents
// ---------------------------------------------------------------------------

function topoSort(schemas: any[]): any[] {
  const byName = new Map<string, any>(
    schemas.map((s) => [s.config.name, s])
  );

  function deps(config: TableConfig): string[] {
    return Object.values(config.columns)
      .map((col) => col.references?.table)
      .filter((t): t is string => t !== undefined && byName.has(t) && t !== config.name);
  }

  const visited = new Set<string>();
  const result: any[] = [];

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);
    const entry = byName.get(name);
    if (!entry) return;
    for (const dep of deps(entry.config)) visit(dep);
    result.push(entry);
  }

  for (const schema of schemas) visit(schema.config.name);

  return result;
}
