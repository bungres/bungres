import { join, resolve } from "node:path";
import type { ResolvedConfig } from "../config.js";
import { colorize } from "../utils/colors.js";

// ---------------------------------------------------------------------------
// migrate — run pending .sql files, track applied in __bungres_migrations
// ---------------------------------------------------------------------------

const MIGRATIONS_TABLE = "__bungres_migrations";

const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`.trim();

export async function runMigrate(config: ResolvedConfig): Promise<void> {
  const migrationsDir = resolve(config.migrationsDir);
  const sql = new Bun.SQL(config.dbUrl);

  try {
    // Ensure tracking table exists
    await sql.unsafe(CREATE_MIGRATIONS_TABLE);

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
    const applied = await sql.unsafe(`SELECT name FROM "${MIGRATIONS_TABLE}"`);
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
        const statements = content
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);

        for (const stmt of statements) {
          await txSql.unsafe(stmt + ";");
        }

        await txSql.unsafe(
          `INSERT INTO "${MIGRATIONS_TABLE}" (name) VALUES ($1)`,
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
