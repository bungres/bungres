import { resolve } from "node:path";
import type { ResolvedConfig } from "../config.js";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// status — show which migrations have been applied vs. pending
// ---------------------------------------------------------------------------

export async function runStatus(config: ResolvedConfig): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit status ")));

  const migrationsDir = resolve(config.out);
  const sql = new Bun.SQL(config.dbUrl);

  const table = config.migrationsTable;
  const schema = config.migrationsSchema;
  const qualifiedTable = `"${schema}"."${table}"`;

  const s = p.spinner();
  s.start("Checking migration status...");

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

    // Discover migration files
    const glob = new Bun.Glob("*.sql");
    const files: string[] = [];
    for await (const file of glob.scan({ cwd: migrationsDir, absolute: false })) {
      files.push(file);
    }
    files.sort();

    if (files.length === 0) {
      s.stop("No files found.");
      p.log.warn(pc.yellow("No migration files found."));
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
    let pendingCount = 0;

    for (const file of files) {
      const isApplied = appliedSet.has(file);
      if (isApplied) {
        p.log.success(`${pc.green("✓ applied ")} ${file}`);
      } else {
        pendingCount++;
        p.log.warn(`${pc.yellow("✗ pending ")} ${file}`);
      }
    }

    p.log.info(`${pc.green(appliedSet.size.toString())} applied, ${pc.yellow(pendingCount.toString())} pending.`);
    p.outro("Done.");
  } catch (err: any) {
    p.log.error(pc.red(`Status check failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}
