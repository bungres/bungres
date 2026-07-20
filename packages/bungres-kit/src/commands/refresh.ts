import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// refresh — truncate all tables to reset data without dropping schema
// ---------------------------------------------------------------------------

export async function runRefresh(config: ResolvedConfig): Promise<void> {
  const schemas = (await loadSchemas(config.schema)).filter((s: any) => s.type === "table") as any[];

  if (schemas.length === 0) {
    console.warn("No table definitions found in schema files.");
    return;
  }

  const sql = new Bun.SQL(config.dbUrl);

  try {
    const tableNames = schemas.map(
      (s) => `"${s.config.schema ? s.config.schema + '"."' : ""}${s.config.name}"`
    );

    console.log(`Truncating ${tableNames.length} tables...`);
    
    // We use CASCADE to handle foreign key constraints automatically
    for (const entry of schemas) {
      const ddl = `TRUNCATE TABLE "${entry.config.name}" CASCADE;`;
      await sql.unsafe(ddl);
      console.log(pc.green(`  ✓ truncated ${entry.config.name}`));
    }

    console.log(pc.green("\nRefresh complete. All tables are now empty."));
  } finally {
    await sql.end();
  }
}
