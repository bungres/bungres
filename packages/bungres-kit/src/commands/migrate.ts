import { join, resolve } from "node:path";
import type { ResolvedConfig } from "../config.js";
import { colorize } from "../utils/colors.js";

// ---------------------------------------------------------------------------
// migrate — run pending .sql files, track applied in the migrations table
// ---------------------------------------------------------------------------

export async function runMigrate(config: ResolvedConfig): Promise<void> {
  const migrationsDir = resolve(config.out);
  const sql = new Bun.SQL(config.dbUrl);

  const table = config.migrationsTable;
  const schema = config.migrationsSchema;
  const qualifiedTable = `"${schema}"."${table}"`;

  const createSchema = `CREATE SCHEMA IF NOT EXISTS "${schema}";`;

  const createMigrationsTable = `
CREATE TABLE IF NOT EXISTS ${qualifiedTable} (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`.trim();

  try {
    // Ensure schema and tracking table exist
    await sql.unsafe(createSchema);
    await sql.unsafe(createMigrationsTable);

    // Discover migration files in order
    const glob = new Bun.Glob("*.sql");
    const files: string[] = [];
    for await (const file of glob.scan({ cwd: migrationsDir, absolute: false })) {
      files.push(file);
    }
    files.sort(); // 0001_ < 0002_ etc.

    if (files.length === 0) {
      console.log(colorize("No migration files found in " + migrationsDir, "yellow"));
      console.log(colorize("Run `bungres generate` first.", "yellow"));
      return;
    }

    // Fetch already applied
    const applied = await sql.unsafe(`SELECT name FROM ${qualifiedTable}`);
    const appliedSet = new Set((applied as { name: string }[]).map((r) => r.name));

    const pending = files.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log(colorize("Everything is up to date.", "green"));
      return;
    }

    console.log(colorize(`\nRunning ${pending.length} pending migration(s)...\n`, "cyan"));

    for (const file of pending) {
      const content = await Bun.file(join(migrationsDir, file)).text();

      if (config.verbose) {
        console.log(`-- ${file} --\n${content}\n`);
      }

      await sql.transaction(async (txSql: InstanceType<typeof Bun.SQL>) => {
        // Split on breakpoint markers if enabled (default: true)
        const statements = config.breakpoints
          ? content
              .split(/-->statement-breakpoint/g)
              .flatMap((chunk) => chunk.split(";").map((s) => s.trim()).filter(Boolean))
          : content
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean);

        for (const stmt of statements) {
          await txSql.unsafe(stmt + ";");
        }

        await txSql.unsafe(
          `INSERT INTO ${qualifiedTable} (name) VALUES ($1)`,
          [file]
        );
      });

      console.log(colorize(`  ✓  ${file}`, "green"));
    }

    console.log(colorize("\nDone.", "green"));
  } finally {
    await sql.end();
  }
}
