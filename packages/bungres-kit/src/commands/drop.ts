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
    // Check which tables actually exist in the database
    const existingTablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' OR table_schema = current_schema()
    `;
    const existingTableNames = new Set(
      existingTablesResult.map((row: any) => row.table_name)
    );

    // Also track the migration and push tables since they are dropped too
    const migrationTableExists = existingTableNames.has("__bungres_migrations");
    const pushTableExists = existingTableNames.has("__bungres_push");

    // Filter our schema list to only those that exist in the DB
    const tablesToDrop = schemas.filter((s) => existingTableNames.has(s.config.name));

    if (tablesToDrop.length === 0 && !migrationTableExists && !pushTableExists) {
      console.log("No tables to drop (they either don't exist or were already dropped).");
      return;
    }

    const tableNamesToPrint = tablesToDrop.map(
      (s) => (s.config.schema ? s.config.schema + "." : "") + s.config.name
    );
    if (migrationTableExists) {
      tableNamesToPrint.push("__bungres_migrations");
    }
    if (pushTableExists) {
      tableNamesToPrint.push("__bungres_push");
    }

    if (!opts.force) {
      console.warn(colorize("\n⚠️  WARNING: This will drop the following tables and ALL their data:\n", "red"));
      for (const name of tableNamesToPrint) console.log(colorize(`  - ${name}`, "yellow"));
      process.stdout.write(colorize("\nAre you sure? Type YES to continue: ", "cyan"));

      // Read confirmation from stdin using Bun's native console iterator
      for await (const line of console) {
        if (line.trim().toLowerCase() !== "yes") {
          console.log("Aborted.");
          return;
        }
        break; // break loop after reading the first line
      }
    }

    for (const entry of tablesToDrop) {
      const ddl = `DROP TABLE IF EXISTS "${entry.config.name}" CASCADE;`;
      await sql.unsafe(ddl);
      console.log(colorize(`  ✓ dropped ${entry.config.name}`, "green"));
    }

    if (migrationTableExists) {
      await sql.unsafe("DROP TABLE IF EXISTS public.__bungres_migrations CASCADE");
      console.log(colorize(`  ✓ dropped __bungres_migrations`, "green"));
    }

    if (pushTableExists) {
      await sql.unsafe("DROP TABLE IF EXISTS public.__bungres_push CASCADE");
      console.log(colorize(`  ✓ dropped __bungres_push`, "green"));
    }

    console.log(colorize("\nDrop complete.", "green"));
  } finally {
    await sql.end();
  }
}
