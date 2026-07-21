import { join, resolve } from "node:path";
import type { ResolvedConfig } from "../config.js";
import { runMigrate } from "./migrate.js";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// refresh — truncate all tables to reset data without dropping schema
// ---------------------------------------------------------------------------

export async function runRefresh(config: ResolvedConfig): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit refresh ")));

  const migrationsDir = resolve(config.out);
  const sql = new Bun.SQL(config.dbUrl);

  const table = config.migrationsTable;
  const schema = config.migrationsSchema;
  const qualifiedTable = `"${schema}"."${table}"`;

  let s = p.spinner();
  s.start("Checking applied migrations...");

  try {
    // Check if migrations table exists
    const migTableCheck = await sql.unsafe(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      [schema, table]
    ) as Array<{ exists: boolean }>;
    const migrationTableExists = migTableCheck[0]?.exists ?? false;

    if (!migrationTableExists) {
      s.stop("No migrations table found.");
      p.log.warn(pc.yellow("No migrations have been applied yet."));
      return;
    }

    const applied = await sql.unsafe(`SELECT name FROM ${qualifiedTable} ORDER BY name DESC`) as { name: string }[];

    if (applied.length === 0) {
      s.stop("No migrations to rollback.");
      p.log.info(pc.yellow("Database is empty."));
    } else {
      s.stop(`Found ${applied.length} migrations to rollback.`);

      const shouldRollback = await p.confirm({
        message: `Are you sure you want to rollback all ${applied.length} migrations and re-apply them?`,
        initialValue: false
      });

      if (p.isCancel(shouldRollback) || !shouldRollback) {
        p.outro(pc.gray("Refresh cancelled."));
        return;
      }

      for (const row of applied) {
        const migrationName = row.name;
        s = p.spinner();
        s.start(`Rolling back ${migrationName}...`);

        let content = "";
        try {
          content = await Bun.file(join(migrationsDir, migrationName)).text();
        } catch (e) {
           s.stop("Failed.");
           p.log.error(pc.red(`Failed to read migration file ${migrationName}. Cannot refresh.`));
           return;
        }

        let downContent = "";
        const downMatch = content.match(/-- ==== DOWN ====([\s\S]*)/i);
        if (downMatch) {
          downContent = downMatch[1]!.trim();
        } else {
          s.stop("Failed.");
          p.log.error(pc.red(`No '-- ==== DOWN ====' section found in ${migrationName}. Cannot rollback safely.`));
          return;
        }

        await sql.transaction(async (txSql: InstanceType<typeof Bun.SQL>) => {
          if (downContent) {
            const statements = config.breakpoints
              ? downContent.split(/-->statement-breakpoint/g).flatMap((chunk) => chunk.split(";").map((s) => s.trim()).filter(Boolean))
              : downContent.split(";").map((s) => s.trim()).filter(Boolean);

            for (const stmt of statements) {
              await txSql.unsafe(stmt + ";");
            }
          }
          await txSql.unsafe(`DELETE FROM ${qualifiedTable} WHERE name = $1`, [migrationName]);
        });
        s.stop(pc.green(`✓ Rolled back ${migrationName}`));
      }
      p.log.success(pc.green(`Successfully rolled back ${applied.length} migrations.`));
    }

    p.log.info(pc.cyan("\nRe-running all migrations..."));
    await runMigrate(config);
    p.outro(pc.cyan("✨ Refresh complete."));

  } catch (err: any) {
    s.stop("Failed.");
    p.log.error(pc.red(`Refresh failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}
