import * as p from "@clack/prompts";
import pc from "picocolors";
import type { ResolvedConfig } from "../config.js";

// ---------------------------------------------------------------------------
// drop — drop all tables defined in the schema (dev utility)
// Always prompts for confirmation unless --force is passed
// ---------------------------------------------------------------------------

export async function runDrop(
  config: ResolvedConfig,
  opts: { force?: boolean } = {}
): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit drop ")));
  const ms = p.spinner();
  ms.start("Scanning database for objects to drop...");

  const sql = new Bun.SQL(config.dbUrl);

  try {
    const userSchema = config.dbSchema || "public";

    // Fetch all views
    const existingViews = await sql.unsafe(
      `SELECT table_name FROM information_schema.views WHERE table_schema = $1`,
      [userSchema]
    ) as { table_name: string }[];

    // Fetch all tables
    const existingTables = await sql.unsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
      [userSchema]
    ) as { table_name: string }[];

    // Fetch all user-defined types (enums)
    const existingTypes = await sql.unsafe(
      `SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = $1 AND t.typtype = 'e'`,
      [userSchema]
    ) as { typname: string }[];

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

    const totalObjects = existingViews.length + existingTables.length + existingTypes.length + (migrationTableExists ? 1 : 0) + (pushTableExists ? 1 : 0);

    if (totalObjects === 0) {
      ms.stop("Nothing to do.");
      p.log.success(pc.green("No items to drop (schema is empty)."));
      p.outro("Done.");
      return;
    }
    ms.stop("Database scan complete.");

    if (!opts.force) {
      p.log.warn(pc.bgRed(pc.white(" ⚠️ WARNING ")));
      p.log.message(pc.bold(pc.red("This will GLOBALLY drop all tables, views, and types in the database schema!")));
      p.log.info(pc.yellow(`Found ${existingViews.length} views, ${existingTables.length} tables, ${existingTypes.length} enums.`));

      const confirm = await p.confirm({
        message: "Are you absolutely sure you want to drop ALL data?",
        initialValue: false
      });

      if (p.isCancel(confirm) || !confirm) {
        p.outro(pc.gray("Drop aborted."));
        return;
      }
    }

    const exSpinner = p.spinner();
    exSpinner.start("Dropping objects...");

    for (const v of existingViews) {
      await sql.unsafe(`DROP VIEW IF EXISTS "${userSchema}"."${v.table_name}" CASCADE;`);
      if (opts.force !== true) p.log.step(pc.gray(`Dropped view ${v.table_name}`));
    }

    for (const t of existingTables) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${userSchema}"."${t.table_name}" CASCADE;`);
      if (opts.force !== true) p.log.step(pc.gray(`Dropped table ${t.table_name}`));
    }

    for (const type of existingTypes) {
      await sql.unsafe(`DROP TYPE IF EXISTS "${userSchema}"."${type.typname}" CASCADE;`);
      if (opts.force !== true) p.log.step(pc.gray(`Dropped enum ${type.typname}`));
    }

    if (migrationTableExists) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${config.migrationsSchema}"."${config.migrationsTable}" CASCADE`);
      if (opts.force !== true) p.log.step(pc.gray(`Dropped ${config.migrationsSchema}.${config.migrationsTable}`));
    }

    if (pushTableExists) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${config.migrationsSchema}"."__bungres_push" CASCADE`);
      if (opts.force !== true) p.log.step(pc.gray(`Dropped ${config.migrationsSchema}.__bungres_push`));
    }

    exSpinner.stop("Items dropped.");
    p.outro(pc.cyan("✨ Drop complete."));
  } catch (err: any) {
    // If an error occurs, make sure we stop any active spinners
    ms.stop("Scan failed.");
    p.log.error(pc.red(`Drop failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}
