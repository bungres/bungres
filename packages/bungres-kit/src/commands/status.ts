import * as p from "@clack/prompts";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import type { ResolvedConfig } from "../config.js";
import { loadMigrationFolders } from "../migration-loader.js";

// ---------------------------------------------------------------------------
// status — show which migrations have been applied vs. pending
// ---------------------------------------------------------------------------

export async function runStatus(config: ResolvedConfig): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit status ")));

  const migrationsDir = resolve(config.out);

  const s = p.spinner();
  s.start("Checking migration status...");

  if (!existsSync(migrationsDir)) {
    s.stop("No migration directory found.");
    p.log.warn(pc.yellow(`Migration directory does not exist: ${migrationsDir}`));
    p.log.info(`Run ${pc.green("bungres generate")} first.`);
    p.outro("Done.");
    return;
  }

  if (!statSync(migrationsDir).isDirectory()) {
    s.stop("Failed.");
    p.log.error(pc.red(`Migration path exists but is not a directory: ${migrationsDir}`));
    p.outro("Failed.");
    return;
  }

  const sql = new Bun.SQL(config.dbUrl);

  const table = config.migrationsTable;
  const schema = config.migrationsSchema;
  const qualifiedTable = `"${schema}"."${table}"`;

  try {
    // Check if migrations table exists
    const tableCheck = await sql.unsafe(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      [schema, table]
    ) as Array<{ exists: boolean }>;

    const trackingExists = tableCheck[0]?.exists ?? false;

    // Discover migration folders
    const folders = await loadMigrationFolders(migrationsDir);

    if (folders.length === 0) {
      s.stop("No migrations found.");
      p.log.warn(pc.yellow("No migration directories found."));
      p.log.info(`Run ${pc.green("bungres generate")} first.`);
      p.outro("Done.");
      return;
    }

    let appliedSet = new Set<string>();
    if (trackingExists) {
      const applied = await sql.unsafe(
        `SELECT name FROM ${qualifiedTable} ORDER BY applied_at`
      ) as Array<{ name: string }>;
      appliedSet = new Set(applied.map((r) => r.name));
    }

    s.stop("Status check complete.");

    p.log.message(pc.bold("Migration status:"));
    let appliedCount = 0;
    let pendingCount = 0;

    for (const folder of folders) {
      const isApplied = appliedSet.has(folder.name);
      if (isApplied) {
        appliedCount++;
        p.log.success(`${pc.green("✓ applied ")} ${folder.name}`);
      } else {
        pendingCount++;
        p.log.warn(`${pc.yellow("✗ pending ")} ${folder.name}`);
      }
    }

    const folderSet = new Set(folders.map((f) => f.name));
    const missingLocal = [...appliedSet].filter((name) => !folderSet.has(name));
    if (missingLocal.length > 0) {
      p.log.warn(pc.yellow(`▲ Database has ${missingLocal.length} applied record(s) missing local migration directories:`));
      for (const m of missingLocal) {
        p.log.warn(pc.yellow(`  - ${m}`));
      }
    }

    p.log.info(`${pc.green(appliedCount.toString())} applied, ${pc.yellow(pendingCount.toString())} pending.`);
    p.outro("Done.");
  } catch (err: any) {
    s.stop("Failed.");
    p.log.error(pc.red(`Status check failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}
