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

  let faker: any;
  try {
    // @ts-ignore - faker might not be installed in the user's project
    const fakerModule = await import("@faker-js/faker");
    faker = fakerModule.faker;
  } catch (err) {
    p.log.error(pc.red("Auto-seeder requires @faker-js/faker."));
    p.log.message(`Please install it: ${pc.green("bun add -d @faker-js/faker")}`);
    p.outro("Failed.");
    return;
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
        for (const [colName, col] of Object.entries(table.columns)) {
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

          // Generate fake data based on type
          if (col.dataType === "uuid") row[col.name] = faker.string.uuid();
          else if (col.dataType === "varchar" || col.dataType === "text") row[col.name] = faker.lorem.word();
          else if (col.dataType === "integer") row[col.name] = faker.number.int({ min: 1, max: 1000 });
          else if (col.dataType === "boolean") row[col.name] = faker.datatype.boolean();
          else if (col.dataType === "timestamptz" || col.dataType === "timestamp") row[col.name] = faker.date.recent().toISOString();
          else if (col.dataType === "jsonb" || col.dataType === "json") row[col.name] = JSON.stringify({ key: faker.lorem.word() });
          else row[col.name] = null; // Fallback
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
