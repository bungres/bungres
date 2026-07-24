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
      p.log.info(pc.cyan(`Executing seed script: ${config.seed}`));

      const proc = Bun.spawn(["bun", "run", seedPath], {
        cwd: process.cwd(),
        stdout: "inherit",
        stderr: "inherit",
        env: { ...Bun.env, DATABASE_URL: config.dbUrl }
      });

      const exitCode = await proc.exited;

      if (exitCode === 0) {
        p.outro(pc.cyan("✨ Seeding successful."));
      } else {
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
    const localFakerPath = resolve(process.cwd(), "node_modules/@faker-js/faker");
    const fakerModule = await import(localFakerPath);
    faker = fakerModule.faker || fakerModule.default?.faker || fakerModule;
    p.log.info(pc.green("✓ Loaded @faker-js/faker for auto-seeding."));
  } catch (err) {
    try {
      // @ts-ignore
      const fakerModule = await import("@faker-js/faker");
      faker = fakerModule.faker;
      p.log.info(pc.green("✓ Loaded @faker-js/faker for auto-seeding."));
    } catch (err2) {
      p.log.info(pc.gray("Using built-in lightweight mock generator (@faker-js/faker not found)."));
    }
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

      const seenCompositeKeys = new Set<string>();

      for (let i = 0; i < rowsToInsert; i++) {
        let row: Record<string, any> = {};
        let attempts = 0;
        let isDuplicate = false;

        do {
          isDuplicate = false;
          row = {};

          for (const [colName, col] of Object.entries(table.columns as Record<string, any>)) {
            const dbColName = col.name || colName;

            // Resolve FK
            if (col.references) {
              const parentTable = col.references.table;
              const parentRows = insertedData[parentTable];
              if (parentTable === table.name) {
                // Self-referential FK (e.g. parent_id in categories): root records need null parent
                if (parentRows && parentRows.length > 0 && i >= 3) {
                  const parentRow = parentRows[Math.floor(Math.random() * parentRows.length)];
                  row[dbColName] = parentRow[col.references.column];
                } else {
                  row[dbColName] = null;
                }
                continue;
              } else if (parentRows && parentRows.length > 0) {
                // Pick random parent
                const parentRow = parentRows[Math.floor(Math.random() * parentRows.length)];
                row[dbColName] = parentRow[col.references.column];
                continue;
              }
            }

            // Generate mock data based on type
            row[dbColName] = generateMockValue(col, i + attempts, faker);
          }

          // Composite key uniqueness tracking for junction tables
          const fkKey = Object.keys(row)
            .filter((k) => k.toLowerCase().endsWith("id"))
            .map((k) => `${k}:${row[k]}`)
            .join("|");

          if (fkKey && seenCompositeKeys.has(fkKey)) {
            isDuplicate = true;
            attempts++;
          } else if (fkKey) {
            seenCompositeKeys.add(fkKey);
          }
        } while (isDuplicate && attempts < 15);

        if (!isDuplicate || rows.length === 0) {
          rows.push(row);
        }
      }

      // Insert into DB
      const insertedRows = await sql.transaction(async (tx) => {
        const results = [];
        for (const row of rows) {
          const keys = Object.keys(row).map(k => `"${k}"`);
          const rawValues = Object.values(row);
          const values = rawValues.map((v) => {
            if (Array.isArray(v)) {
              return `{${v.map((item) => `"${String(item).replace(/"/g, '\\"')}"`).join(",")}}`;
            }
            return v;
          });
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
  // Enum handling
  if (col.enumConfig && Array.isArray(col.enumConfig.enumValues) && col.enumConfig.enumValues.length > 0) {
    const vals = col.enumConfig.enumValues;
    return faker ? faker.helpers.arrayElement(vals) : vals[index % vals.length];
  }

  const dt = (col.dataType || "").toLowerCase();
  const cName = (col.name || "").toLowerCase();
  const maxLen = typeof col.length === "number" ? col.length : undefined;

  const isUnique = !!(col.isUnique || col.unique || col.primaryKey || cName.includes("email") || cName.includes("slug") || cName.includes("sku"));
  const suffix = `_${crypto.randomUUID().slice(0, 8)}`;

  // Array handling (must be checked before scalar semantic checks)
  if (dt.endsWith("[]")) {
    if (cName.includes("url") || cName.includes("image")) {
      return [
        `https://example.com/${col.name || "img"}_1${suffix}.jpg`,
        `https://example.com/${col.name || "img"}_2${suffix}.jpg`
      ];
    }
    if (faker) return [faker.lorem.word(), faker.lorem.word()];
    return [`${col.name || "val"}_1${suffix}`, `${col.name || "val"}_2${suffix}`];
  }

  if (cName.includes("currency") || maxLen === 3) {
    const currencies = ["USD", "EUR", "GBP", "JPY", "CAD"];
    return currencies[index % currencies.length];
  }

  let result: any = null;

  // Semantic string mock generators
  if (cName.includes("email")) {
    result = faker ? faker.internet.email() : `user_${index + 1}${suffix}@example.com`;
  } else if (cName.includes("slug")) {
    result = faker ? faker.lorem.slug() : `slug_${index + 1}${suffix}`;
  } else if (cName.includes("sku")) {
    result = `SKU-${index + 1}${suffix.toUpperCase()}`;
  } else if (cName.includes("url") || cName.includes("image")) {
    result = faker ? faker.image.url() : `https://example.com/${col.name || "item"}_${index + 1}${suffix}`;
  } else if (faker) {
    if (dt === "uuid") result = faker.string.uuid();
    else if (dt === "varchar" || dt === "text" || dt === "char") result = `${faker.lorem.word()}${isUnique ? suffix : ""}`;
    else if (dt === "integer" || dt === "bigint" || dt === "smallint" || dt === "serial" || dt === "bigserial") {
      result = isUnique ? Math.floor(Math.random() * 1000000) + index + 1 : faker.number.int({ min: 1, max: 1000 });
    } else if (dt === "numeric" || dt === "decimal" || dt === "real" || dt === "double precision") {
      result = faker.number.float({ min: 1, max: 500, fractionDigits: 2 });
    } else if (dt === "boolean") result = faker.datatype.boolean();
    else if (dt === "timestamptz" || dt === "timestamp" || dt === "date" || dt === "time") result = faker.date.recent().toISOString();
    else if (dt === "jsonb" || dt === "json") result = JSON.stringify({ key: faker.lorem.word() });
  }

  // Built-in lightweight fallback
  if (result === null) {
    if (dt === "uuid") result = crypto.randomUUID();
    else if (dt === "varchar" || dt === "text" || dt === "char") result = `${col.name || "val"}_${index + 1}${isUnique ? suffix : ""}`;
    else if (dt === "integer" || dt === "bigint" || dt === "smallint" || dt === "serial" || dt === "bigserial") result = isUnique ? Math.floor(Math.random() * 1000000) + index + 1 : index + 1;
    else if (dt === "numeric" || dt === "decimal" || dt === "real" || dt === "double precision") result = (index + 1) * 10;
    else if (dt === "boolean") result = index % 2 === 0;
    else if (dt === "timestamptz" || dt === "timestamp" || dt === "date" || dt === "time") result = new Date().toISOString();
    else if (dt === "jsonb" || dt === "json") result = JSON.stringify({ index, sample: true });
    else if (col.notNull && !col.isNullable) result = `${col.name || "val"}_${index + 1}${suffix}`;
  }

  // Length truncation for varchar(N) / char(N)
  if (typeof result === "string" && maxLen && result.length > maxLen) {
    result = result.slice(0, maxLen);
  }

  return result;
}
