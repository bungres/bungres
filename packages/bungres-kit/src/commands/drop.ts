import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";
import { colorize } from "../utils/colors.js";

// ---------------------------------------------------------------------------
// drop — drop all tables defined in the schema (dev utility)
// Always prompts for confirmation unless --force is passed
// ---------------------------------------------------------------------------

export async function runDrop(
  config: ResolvedConfig,
  opts: { force?: boolean } = {}
): Promise<void> {
  const schemas = await loadSchemas(config.schema);

  if (schemas.length === 0) {
    console.warn("No table definitions found in schema files.");
    return;
  }

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
    const tablesToDrop = schemas.filter((s) => existingTableNames.has(s.config.name));

    if (tablesToDrop.length === 0 && !migrationTableExists && !pushTableExists) {
      console.log("No tables to drop (they either don't exist or were already dropped).");
      return;
    }

    const tableNamesToPrint = tablesToDrop.map(
      (s) => (s.config.schema ? s.config.schema + "." : "") + s.config.name
    );
    if (migrationTableExists) {
      tableNamesToPrint.push(`${config.migrationsSchema}.${config.migrationsTable}`);
    }
    if (pushTableExists) {
      tableNamesToPrint.push(`${config.migrationsSchema}.__bungres_push`);
    }

    if (!opts.force) {
      console.warn(colorize("\n⚠️  WARNING: This will drop the following tables and ALL their data:\n", "red"));
      for (const name of tableNamesToPrint) console.log(colorize(`  - ${name}`, "yellow"));
      process.stdout.write(colorize("\nAre you sure? Type YES to continue: ", "cyan"));

      for await (const line of console) {
        if (line.trim().toLowerCase() !== "yes") {
          console.log("Aborted.");
          return;
        }
        break;
      }
    }

    for (const entry of tablesToDrop) {
      const ddl = `DROP TABLE IF EXISTS "${entry.config.name}" CASCADE;`;
      await sql.unsafe(ddl);
      console.log(colorize(`  ✓ dropped ${entry.config.name}`, "green"));
    }

    if (migrationTableExists) {
      const qualifiedMigTable = `"${config.migrationsSchema}"."${config.migrationsTable}"`;
      await sql.unsafe(`DROP TABLE IF EXISTS ${qualifiedMigTable} CASCADE`);
      console.log(colorize(`  ✓ dropped ${config.migrationsSchema}.${config.migrationsTable}`, "green"));
    }

    if (pushTableExists) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${config.migrationsSchema}"."__bungres_push" CASCADE`);
      console.log(colorize(`  ✓ dropped ${config.migrationsSchema}.__bungres_push`, "green"));
    }

    console.log(colorize("\nDrop complete.", "green"));
  } finally {
    await sql.end();
  }
}
