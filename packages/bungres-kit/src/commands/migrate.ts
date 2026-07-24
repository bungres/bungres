import { join, resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import type { ResolvedConfig } from "../config.js";
import { splitSqlStatements } from "../sql-splitter.js";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// migrate — run pending .sql files, track applied in the migrations table
// ---------------------------------------------------------------------------

export async function runMigrate(config: ResolvedConfig): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit migrate ")));

  const migrationsDir = resolve(config.out);

  let s = p.spinner();
  s.start("Checking pending migrations...");

  if (!existsSync(migrationsDir)) {
    s.stop("No files found.");
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
      s.stop("No files found.");
      p.log.warn(pc.yellow(`No migration files found in ${migrationsDir}`));
      p.log.info(`Run ${pc.green("bungres generate")} first.`);
      p.outro("Done.");
      return;
    }

    // Fetch already applied
    const applied = await sql.unsafe(`SELECT name FROM ${qualifiedTable}`);
    const appliedSet = new Set((applied as { name: string }[]).map((r) => r.name));

    const pending = files.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      s.stop("Up to date.");
      p.log.success(pc.green("Everything is up to date."));
      p.outro("Done.");
      return;
    }

    s.stop(`Found ${pending.length} pending migration(s).`);

    for (const file of pending) {
      s = p.spinner();
      s.start(`Applying ${file}...`);
      
      const filePath = join(migrationsDir, file);
      if (!existsSync(filePath)) {
        s.stop("Failed.");
        p.log.error(pc.red(`Migration file not found: ${filePath}`));
        p.outro("Failed.");
        return;
      }

      let content = "";
      try {
        content = await Bun.file(filePath).text();
      } catch (err: any) {
        s.stop("Failed.");
        p.log.error(pc.red(`Failed to read migration file ${file}: ${err.message}`));
        p.outro("Failed.");
        return;
      }

      // Extract only the UP section if delimiters exist
      let upContent = content;
      const upMatch = content.match(/-- ==== UP ====([\s\S]*?)(?:-- ==== DOWN ====|$)/i);
      if (upMatch) {
        upContent = upMatch[1]!.trim();
      }

      if (config.verbose) {
        p.log.info(pc.gray(`-- ${file} --\n${upContent}\n`));
      }

      await sql.transaction(async (txSql: InstanceType<typeof Bun.SQL>) => {
        const statements = config.breakpoints
          ? upContent
              .split(/-->statement-breakpoint/g)
              .flatMap((chunk) => splitSqlStatements(chunk))
          : splitSqlStatements(upContent);

        for (const stmt of statements) {
          const clean = stmt.replace(/--.*$/gm, "").trim();
          if (!clean) continue;

          const isIdempotentDdl = /CREATE\s+(TYPE|TABLE|(UNIQUE\s+)?INDEX|(MATERIALIZED\s+)?VIEW)\b/i.test(clean);
          if (isIdempotentDdl) {
            try {
              await txSql.unsafe("SAVEPOINT bungres_sp;");
              await txSql.unsafe(stmt + ";");
              await txSql.unsafe("RELEASE SAVEPOINT bungres_sp;");
            } catch (err: any) {
              await txSql.unsafe("ROLLBACK TO SAVEPOINT bungres_sp;");
              const msg = (err.message || "").toLowerCase();
              if (msg.includes("already exists") || ["42710", "42P07", "42712"].includes(err.code)) {
                if (config.verbose) {
                  p.log.info(pc.gray(`Object already exists, continuing: ${err.message}`));
                }
              } else {
                throw err;
              }
            }
          } else {
            await txSql.unsafe(stmt + ";");
          }
        }

        await txSql.unsafe(
          `INSERT INTO ${qualifiedTable} (name) VALUES ($1)`,
          [file]
        );
      });

      s.stop(pc.green(`✓ Applied ${file}`));
    }

    p.outro(pc.cyan("✨ All migrations applied successfully."));
  } catch (err: any) {
    s.stop("Failed.");
    p.log.error(pc.red(`Migration failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}
