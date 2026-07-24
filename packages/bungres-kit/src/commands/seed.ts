import { resolve } from "node:path";
import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";
import { topoSortConfigs } from "../differ.js";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// seed — execute a seed script or auto-seed the database
// ---------------------------------------------------------------------------

export async function runSeed(config: ResolvedConfig): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit seed ")));

  // If a seed script is explicitly configured and exists, run it
  if (config.seed) {
    const seedPath = resolve(process.cwd(), config.seed);
    const file = Bun.file(seedPath);
    if (await file.exists()) {
      const s = p.spinner();
      s.start(`Running seeder: ${config.seed}...`);

      const proc = Bun.spawn(["bun", "run", seedPath], {
        cwd: process.cwd(),
        stdout: "inherit",
        stderr: "inherit",
        env: { ...Bun.env, DATABASE_URL: config.dbUrl }
      });

      const exitCode = await proc.exited;

      if (exitCode === 0) {
        s.stop("Seed complete.");
        p.outro(pc.cyan("✨ Seeding successful."));
      } else {
        s.stop("Seed failed.");
        p.log.error(pc.red(`Seed failed with exit code ${exitCode}.`));
        p.outro("Failed.");
        process.exit(exitCode);
      }
      return;
    }
  }

  // Fallback: Auto-seeder
  p.log.info(pc.blue("No custom seed script found. Initiating Auto-Seeder..."));

  let faker: any = null;
  try {
    // @ts-ignore - faker might not be installed in the user's project
    const fakerModule = await import("@faker-js/faker");
    faker = fakerModule.faker;
  } catch (err) {
    p.log.info(pc.gray("Using built-in lightweight mock generator (@faker-js/faker not found)."));
  }

  let s = p.spinner();
  s.start("Loading schemas for auto-seeding...");

  const schemas = (await loadSchemas(config.schema)).filter((s: any) => s.type === "table") as any[];
  if (schemas.length === 0) {
    s.stop("No schemas.");
    p.outro("Nothing to seed.");
    return;
  }

  const tableConfigs = schemas.map(s => s.config);
  const sorted = topoSortConfigs(tableConfigs);

  s.stop(`Loaded ${sorted.length} tables in topological order.`);

  const sql = new Bun.SQL(config.dbUrl);
  
  // Track inserted IDs for foreign key resolution
  const insertedData: Record<string, any[]> = {};

  try {
    for (const table of sorted) {
      s = p.spinner();
      s.start(`Seeding ${table.name}...`);
      
      const rowsToInsert = 10;
      const rows: any[] = [];

      for (let i = 0; i < rowsToInsert; i++) {
        const row: Record<string, any> = {};
        for (const [colName, col] of Object.entries(table.columns as Record<string, any>)) {
          // Resolve FK
          if (col.references) {
            const parentTable = col.references.table;
            const parentRows = insertedData[parentTable];
            if (parentRows && parentRows.length > 0) {
              // Pick random parent
              const parentRow = parentRows[Math.floor(Math.random() * parentRows.length)];
              row[col.name] = parentRow[col.references.column];
              continue;
            }
          }

          // Generate mock data based on type
          row[col.name] = generateMockValue(col, i, faker);
        }
        rows.push(row);
      }

      // Insert into DB
      const insertedRows = await sql.transaction(async (tx) => {
        const results = [];
        for (const row of rows) {
          const keys = Object.keys(row).map(k => `"${k}"`);
          const values = Object.values(row);
          const placeholders = values.map((_, i) => `$${i + 1}`);
          
          const q = `INSERT INTO "${table.schema || 'public'}"."${table.name}" (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
          const res = await tx.unsafe(q, values);
          results.push(res[0]);
        }
        return results;
      });

      insertedData[table.name] = insertedRows;
      s.stop(pc.green(`✓ Seeded ${rowsToInsert} rows into ${table.name}`));
    }

    p.outro(pc.cyan("✨ Auto-seeding complete."));
  } catch (err: any) {
    s.stop("Failed.");
    p.log.error(pc.red(`Auto-seeding failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}

function generateMockValue(col: any, index: number, faker?: any): any {
  if (faker) {
    if (col.dataType === "uuid") return faker.string.uuid();
    if (col.dataType === "varchar" || col.dataType === "text") return faker.lorem.word();
    if (col.dataType === "integer" || col.dataType === "bigint" || col.dataType === "smallint") return faker.number.int({ min: 1, max: 1000 });
    if (col.dataType === "boolean") return faker.datatype.boolean();
    if (col.dataType === "timestamptz" || col.dataType === "timestamp" || col.dataType === "date") return faker.date.recent().toISOString();
    if (col.dataType === "jsonb" || col.dataType === "json") return JSON.stringify({ key: faker.lorem.word() });
  }

  // Built-in lightweight fallback
  if (col.dataType === "uuid") return crypto.randomUUID();
  if (col.dataType === "varchar" || col.dataType === "text") return `${col.name}_${index + 1}`;
  if (col.dataType === "integer" || col.dataType === "bigint" || col.dataType === "smallint") return index + 1;
  if (col.dataType === "boolean") return index % 2 === 0;
  if (col.dataType === "timestamptz" || col.dataType === "timestamp" || col.dataType === "date") return new Date().toISOString();
  if (col.dataType === "jsonb" || col.dataType === "json") return JSON.stringify({ index, sample: true });
  return null;
}
