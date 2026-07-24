import { resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";
import { diffSchemas, type SchemaSnapshot } from "../differ.js";
import { loadLatestSnapshotFromFolders, loadMigrationFolders } from "../migration-loader.js";
import { inlineParams } from "@bungres/orm";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// check — CI / CD tool to verify if schema is in sync with migrations & DB
// Exits with 0 if up-to-date, 1 if schema drift or unapplied migrations exist
// ---------------------------------------------------------------------------

export async function runCheck(
  config: ResolvedConfig,
  opts: { checkDb?: boolean } = {}
): Promise<boolean> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit check ")));
  const s = p.spinner();
  s.start("Checking schema drift & migration state...");

  const schemas = await loadSchemas(config.schema);
  if (schemas.length === 0) {
    s.stop("No schemas found.");
    p.log.warn(pc.yellow("No table definitions found. Check your schema glob pattern."));
    p.outro("Failed.");
    return false;
  }

  const migrationsDir = resolve(config.out);

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
        sql: typeof s.config.query?.toSQL === "function" ? inlineParams(s.config.query.toSQL()) : s.config.sql
      };
    }
  }

  // ── Load previous snapshot ────────────────────────────────────────────────
  const latestFolderSnapshot = await loadLatestSnapshotFromFolders(migrationsDir);
  const prevSnapshot: SchemaSnapshot = latestFolderSnapshot || { tables: {}, enums: {}, views: {} };
  const hasSnapshot = !!latestFolderSnapshot;

  const diff = diffSchemas(prevSnapshot, currentSnapshot);
  let isClean = true;

  s.stop("Schema drift check complete.");

  if (!hasSnapshot && Object.keys(currentSnapshot.tables).length > 0) {
    p.log.error(pc.red("✖ No migration snapshot found. Unsaved schema definitions exist."));
    p.log.info(`Run ${pc.green("bungres generate")} to create a migration file.`);
    isClean = false;
  } else if (diff.statements.length > 0) {
    p.log.error(pc.red(`✖ Schema drift detected! Found ${diff.statements.length} ungenerated change(s):`));
    for (const change of diff.summary) {
      p.log.error(pc.red(`  - ${change}`));
    }
    p.log.info(`Run ${pc.green("bungres generate")} to update migration files.`);
    isClean = false;
  } else {
    p.log.success(pc.green("✓ Schema definitions match the latest migration snapshot."));
  }

  // ── Check Database Pending Migrations (Optional or if DB URL is accessible) ──
  if (opts.checkDb && config.dbUrl) {
    try {
      const sql = new Bun.SQL(config.dbUrl);
      const table = config.migrationsTable;
      const schema = config.migrationsSchema;
      const qualifiedTable = `"${schema}"."${table}"`;

      const tableCheck = await sql.unsafe(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        ) AS exists`,
        [schema, table]
      ) as Array<{ exists: boolean }>;

      const trackingExists = tableCheck[0]?.exists ?? false;

      if (existsSync(migrationsDir) && statSync(migrationsDir).isDirectory()) {
        const folders = await loadMigrationFolders(migrationsDir);

        let appliedSet = new Set<string>();
        if (trackingExists) {
          const applied = await sql.unsafe(`SELECT name FROM ${qualifiedTable}`) as Array<{ name: string }>;
          appliedSet = new Set(applied.map((r) => r.name));
        }

        const pending = folders.filter((f) => !appliedSet.has(f.name));
        if (pending.length > 0) {
          p.log.error(pc.red(`✖ Database is missing ${pending.length} migration(s):`));
          for (const f of pending) {
            p.log.error(pc.yellow(`  - ${f.name}`));
          }
          p.log.info(`Run ${pc.green("bungres migrate")} to apply pending migrations.`);
          isClean = false;
        } else {
          p.log.success(pc.green("✓ Database schema is up to date with all migrations."));
        }
      }
      await sql.end();
    } catch (err: any) {
      p.log.warn(pc.yellow(`Could not verify database connection: ${err.message}`));
    }
  }

  if (isClean) {
    p.outro(pc.cyan("✨ Schema & migrations check passed cleanly."));
  } else {
    p.outro(pc.red("✖ Check failed. Schema drift or pending migrations detected."));
  }

  return isClean;
}
