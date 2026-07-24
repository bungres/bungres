import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { ResolvedConfig } from "../config.js";
import { splitSqlStatements } from "../sql-splitter.js";
import { loadMigrationFolders } from "../migration-loader.js";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// rollback — revert the last applied migration folder (down.sql)
// ---------------------------------------------------------------------------

export async function runRollback(config: ResolvedConfig): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit rollback ")));

  const migrationsDir = resolve(config.out);

  let activeSpinner = p.spinner();
  activeSpinner.start("Checking applied migrations...");

  if (!existsSync(migrationsDir)) {
    activeSpinner.stop("No migration directory found.");
    p.log.warn(pc.yellow(`Migration directory does not exist: ${migrationsDir}`));
    p.outro("Done.");
    return;
  }

  if (!statSync(migrationsDir).isDirectory()) {
    activeSpinner.stop("Failed.");
    p.log.error(pc.red(`Migration path exists but is not a directory: ${migrationsDir}`));
    p.outro("Failed.");
    return;
  }

  const sql = new Bun.SQL(config.dbUrl);

  const table = config.migrationsTable;
  const schema = config.migrationsSchema;
  const qualifiedTable = `"${schema}"."${table}"`;

  try {
    // Fetch last applied migration
    const applied = await sql.unsafe(`SELECT name FROM ${qualifiedTable} ORDER BY name DESC LIMIT 1`);
    
    if (applied.length === 0) {
      activeSpinner.stop("No migrations to rollback.");
      p.log.warn(pc.yellow("No applied migrations found in the database."));
      p.outro("Done.");
      return;
    }

    const lastMigration = (applied[0] as { name: string }).name;
    const folders = await loadMigrationFolders(migrationsDir);
    const folder = folders.find((f) => f.name === lastMigration);

    if (!folder) {
      activeSpinner.stop("Migration directory missing.");
      p.log.error(pc.red(`The database tracks '${lastMigration}' as applied, but the directory does not exist in ${migrationsDir}.`));
      p.outro("Failed.");
      return;
    }

    activeSpinner.stop(`Found migration to rollback: ${pc.cyan(lastMigration)}`);

    const shouldRollback = await p.confirm({
      message: `Are you sure you want to rollback ${pc.cyan(lastMigration)}?`,
      initialValue: true
    });

    if (p.isCancel(shouldRollback) || !shouldRollback) {
      p.outro(pc.gray("Rollback cancelled."));
      return;
    }

    activeSpinner = p.spinner();
    activeSpinner.start(`Rolling back ${lastMigration}...`);

    const downContent = folder.downContent;

    if (config.verbose) {
      p.log.info(pc.gray(`-- ${lastMigration}/down.sql --\n${downContent}\n`));
    }

    await sql.transaction(async (txSql: InstanceType<typeof Bun.SQL>) => {
      if (downContent) {
        const statements = config.breakpoints
          ? downContent
              .split(/-->statement-breakpoint/g)
              .flatMap((chunk) => splitSqlStatements(chunk))
          : splitSqlStatements(downContent);

        for (const stmt of statements) {
          await txSql.unsafe(stmt + ";");
        }
      }

      await txSql.unsafe(
        `DELETE FROM ${qualifiedTable} WHERE name = $1`,
        [lastMigration]
      );
    });

    activeSpinner.stop(pc.green(`✓ Rolled back ${lastMigration}`));
    p.outro(pc.cyan("✨ Rollback successful."));

  } catch (err: any) {
    activeSpinner.stop("Failed.");
    p.log.error(pc.red(`Rollback failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}
