import { resolve, join } from "node:path";
import type { ResolvedConfig } from "../config.js";
import { colorize } from "../utils/colors.js";

// ---------------------------------------------------------------------------
// status — show which migrations have been applied vs. pending
// ---------------------------------------------------------------------------

const MIGRATIONS_TABLE = "__bungres_migrations";

export async function runStatus(config: ResolvedConfig): Promise<void> {
  const migrationsDir = resolve(config.migrationsDir);
  const sql = new Bun.SQL(config.dbUrl);

  try {
    // Check if migrations table exists
    const tableCheck = await sql.unsafe(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = $1
      ) AS exists`,
      [MIGRATIONS_TABLE]
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
      console.log(colorize("No migration files found. Run `bungres generate` first.", "yellow"));
      return;
    }

    let appliedSet = new Set<string>();
    if (trackingExists) {
      const applied = await sql.unsafe(
        `SELECT name FROM "${MIGRATIONS_TABLE}" ORDER BY applied_at`
      ) as Array<{ name: string }>;
      appliedSet = new Set(applied.map((r) => r.name));
    }

    console.log(colorize("\nMigration status:\n", "cyan"));
    let pendingCount = 0;

    for (const file of files) {
      const isApplied = appliedSet.has(file);
      const status = isApplied ? colorize("✓ applied ", "green") : colorize("✗ pending ", "yellow");
      if (!isApplied) pendingCount++;
      console.log(`  ${status}  ${file}`);
    }

    console.log(
      `\n${colorize(appliedSet.size.toString(), "green")} applied, ${colorize(pendingCount.toString(), "yellow")} pending.\n`
    );
  } finally {
    await sql.end();
  }
}
