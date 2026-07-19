import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// drop — drop all tables defined in the schema (dev utility)
// Always prompts for confirmation unless --force is passed
// ---------------------------------------------------------------------------

export async function runDrop(
  config: ResolvedConfig,
  opts: { force?: boolean } = {}
): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit drop ")));
  const s = p.spinner();
  s.start("Loading schemas...");

  const schemas = await loadSchemas(config.schema);

  if (schemas.length === 0) {
    s.stop("No schemas found.");
    p.log.warn(pc.yellow("No table definitions found in schema files."));
    p.outro("Failed.");
    return;
  }
  s.stop(`Loaded ${schemas.length} schemas.`);

  const ms = p.spinner();
  ms.start("Checking database tables...");

  const sql = new Bun.SQL(config.dbUrl);

  try {
    // Check which user tables exist in the database (in dbSchema, default: public)
    const userSchema = config.dbSchema;
    const existingUserTablesResult = await sql.unsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      [userSchema]
    );
    const existingTableNames = new Set(
      (existingUserTablesResult as { table_name: string }[]).map((r) => r.table_name)
    );

    // Check if the migrations table exists in its own schema (default: bungres)
    const migTableCheck = await sql.unsafe(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      [config.migrationsSchema, config.migrationsTable]
    ) as Array<{ exists: boolean }>;
    const migrationTableExists = migTableCheck[0]?.exists ?? false;

    // Check push tracking table (also lives in migrationsSchema)
    const pushTableCheck = await sql.unsafe(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists`,
      [config.migrationsSchema, "__bungres_push"]
    ) as Array<{ exists: boolean }>;
    const pushTableExists = pushTableCheck[0]?.exists ?? false;

    // Filter user schema list to only those that exist in the DB
    const tablesToDrop = schemas.filter((sch) => existingTableNames.has(sch.config.name));

    if (tablesToDrop.length === 0 && !migrationTableExists && !pushTableExists) {
      ms.stop("Nothing to do.");
      p.log.success(pc.green("No tables to drop (they either don't exist or were already dropped)."));
      p.outro("Done.");
      return;
    }
    ms.stop("Database check complete.");

    const tableNamesToPrint = tablesToDrop.map(
      (sch) => (sch.config.schema ? sch.config.schema + "." : "") + sch.config.name
    );
    if (migrationTableExists) {
      tableNamesToPrint.push(`${config.migrationsSchema}.${config.migrationsTable}`);
    }
    if (pushTableExists) {
      tableNamesToPrint.push(`${config.migrationsSchema}.__bungres_push`);
    }

    if (!opts.force) {
      p.log.warn(pc.bgRed(pc.white(" ⚠️ WARNING ")));
      p.log.message(pc.bold(pc.red("This will drop the following tables and ALL their data:")));
      for (const name of tableNamesToPrint) {
        p.log.info(pc.yellow(`  - ${name}`));
      }

      const confirm = await p.confirm({
        message: "Are you sure you want to proceed?",
        initialValue: false
      });

      if (p.isCancel(confirm) || !confirm) {
        p.outro(pc.gray("Drop aborted."));
        return;
      }
    }

    const exSpinner = p.spinner();
    exSpinner.start("Dropping tables...");

    for (const entry of tablesToDrop) {
      const ddl = `DROP TABLE IF EXISTS "${entry.config.name}" CASCADE;`;
      await sql.unsafe(ddl);
      p.log.step(pc.gray(`Dropped ${entry.config.name}`));
    }

    if (migrationTableExists) {
      const qualifiedMigTable = `"${config.migrationsSchema}"."${config.migrationsTable}"`;
      await sql.unsafe(`DROP TABLE IF EXISTS ${qualifiedMigTable} CASCADE`);
      p.log.step(pc.gray(`Dropped ${config.migrationsSchema}.${config.migrationsTable}`));
    }

    if (pushTableExists) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${config.migrationsSchema}"."__bungres_push" CASCADE`);
      p.log.step(pc.gray(`Dropped ${config.migrationsSchema}.__bungres_push`));
    }

    exSpinner.stop("Tables dropped.");
    p.outro(pc.cyan("✨ Drop complete."));
  } catch (err: any) {
    p.log.error(pc.red(`Drop failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}
