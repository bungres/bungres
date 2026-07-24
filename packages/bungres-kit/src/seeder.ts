// ---------------------------------------------------------------------------
// @bungres/kit — High-Performance Fluent Blueprint Seeder API (defineSeed)
// ---------------------------------------------------------------------------

import { topoSortConfigs } from "./differ.js";
import { TableConfigSymbol } from "@bungres/orm";
import * as p from "@clack/prompts";
import pc from "picocolors";

export interface FakeGenerator {
  values<T>(items: T[], weights?: number[]): (index: number) => T;
  email(): (index: number) => string;
  fullName(): (index: number) => string;
  firstName(): (index: number) => string;
  lastName(): (index: number) => string;
  company(): (index: number) => string;
  department(): (index: number) => string;
  city(): (index: number) => string;
  country(): (index: number) => string;
  number(opts?: { min?: number; max?: number; precision?: number }): (index: number) => number;
  boolean(opts?: { truePercentage?: number }): (index: number) => boolean;
  date(opts?: { min?: Date | string; max?: Date | string }): (index: number) => string;
  uuid(): (index: number) => string;
  lorem(words?: number): (index: number) => string;
  image(): (index: number) => string;
  custom<T>(fn: (index: number) => T): (index: number) => T;
}

export interface RelGenerator {
  parent(tableName: string, colName?: string): { __isRel: true; tableName: string; colName: string };
}

export class TableBlueprint {
  public tableName: string;
  public _count: number = 10;
  public _columns: Record<string, any> = {};
  public _shouldTruncate: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  count(n: number): this {
    this._count = n;
    return this;
  }

  columns(cols: Record<string, any>): this {
    this._columns = cols;
    return this;
  }

  truncate(shouldTruncate: boolean = true): this {
    this._shouldTruncate = shouldTruncate;
    return this;
  }
}

export interface SeedHelpers {
  fake: FakeGenerator;
  rel: RelGenerator;
  table(tableName: string): TableBlueprint;
  truncate(): void;
}

export interface SeedDefinition {
  db: any;
  schema: any;
  blueprints: Map<string, TableBlueprint>;
  shouldTruncateAll: boolean;
  execute(): Promise<void>;
}

export function createFakeGenerator(faker?: any): FakeGenerator {
  return {
    values<T>(items: T[], weights?: number[]): (index: number) => T {
      if (!items || items.length === 0) throw new Error("seed.fake.values requires a non-empty array");
      if (weights && weights.length === items.length) {
        const total = weights.reduce((a, b) => a + b, 0);
        const cumsum: number[] = [];
        let sum = 0;
        for (const w of weights) {
          sum += w;
          cumsum.push(sum);
        }
        return () => {
          const r = Math.random() * total;
          for (let i = 0; i < cumsum.length; i++) {
            if (r <= cumsum[i]!) return items[i]!;
          }
          return items[items.length - 1]!;
        };
      }
      return (index: number) => {
        if (faker) return faker.helpers.arrayElement(items);
        return items[index % items.length]!;
      };
    },

    email(): (index: number) => string {
      return (index: number) => {
        const uuid = crypto.randomUUID().slice(0, 6);
        return faker ? `${faker.internet.email().split("@")[0]}_${uuid}@example.com` : `user_${index + 1}_${uuid}@example.com`;
      };
    },

    fullName(): (index: number) => string {
      return () => (faker ? faker.person.fullName() : "John Doe");
    },

    firstName(): (index: number) => string {
      return () => (faker ? faker.person.firstName() : "John");
    },

    lastName(): (index: number) => string {
      return () => (faker ? faker.person.lastName() : "Doe");
    },

    company(): (index: number) => string {
      return () => (faker ? faker.company.name() : "Acme Corp");
    },

    department(): (index: number) => string {
      return () => (faker ? faker.commerce.department() : "Electronics");
    },

    city(): (index: number) => string {
      return () => (faker ? faker.location.city() : "San Francisco");
    },

    country(): (index: number) => string {
      return () => (faker ? faker.location.country() : "United States");
    },

    number(opts?: { min?: number; max?: number; precision?: number }): (index: number) => number {
      const min = opts?.min ?? 1;
      const max = opts?.max ?? 1000;
      const prec = opts?.precision ?? 0;
      return () => {
        const val = min + Math.random() * (max - min);
        if (prec > 0) return parseFloat(val.toFixed(prec));
        return Math.floor(val);
      };
    },

    boolean(opts?: { truePercentage?: number }): (index: number) => boolean {
      const pct = (opts?.truePercentage ?? 50) / 100;
      return () => Math.random() < pct;
    },

    date(opts?: { min?: Date | string; max?: Date | string }): (index: number) => string {
      return () => {
        if (faker) return faker.date.recent().toISOString();
        return new Date().toISOString();
      };
    },

    uuid(): (index: number) => string {
      return () => crypto.randomUUID();
    },

    lorem(words?: number): (index: number) => string {
      const count = words ?? 5;
      return () => (faker ? faker.lorem.words(count) : "Lorem ipsum dolor sit amet");
    },

    image(): (index: number) => string {
      return (index: number) => (faker ? faker.image.url() : `https://example.com/img_${index + 1}.jpg`);
    },

    custom<T>(fn: (index: number) => T): (index: number) => T {
      return fn;
    },
  };
}

export function createRelGenerator(): RelGenerator {
  return {
    parent(tableName: string, colName?: string) {
      return { __isRel: true, tableName, colName: colName || "id" };
    },
  };
}

export function defineSeed(
  db: any,
  schema: Record<string, any>,
  builderFn?: (seed: SeedHelpers) => void
): SeedDefinition {
  const blueprints = new Map<string, TableBlueprint>();
  let shouldTruncateAll = false;

  let faker: any = null;
  try {
    const fakerModule = require("@faker-js/faker");
    faker = fakerModule.faker || fakerModule.default?.faker || fakerModule;
  } catch (e) {
    // Faker optional
  }

  const fake = createFakeGenerator(faker);
  const rel = createRelGenerator();

  const helpers: SeedHelpers = {
    fake,
    rel,
    table(tableName: string) {
      if (!blueprints.has(tableName)) {
        blueprints.set(tableName, new TableBlueprint(tableName));
      }
      return blueprints.get(tableName)!;
    },
    truncate() {
      shouldTruncateAll = true;
    },
  };

  if (builderFn) {
    builderFn(helpers);
  }

  return {
    db,
    schema,
    blueprints,
    shouldTruncateAll,
    async execute() {
      await executeSeedDefinition(this);
    },
  };
}

function extractTableConfig(val: any): any {
  if (!val || typeof val !== "object") return null;
  if (TableConfigSymbol in val) return val[TableConfigSymbol];
  if ("config" in val && val.config?.name && val.config?.columns) return val.config;
  if ("name" in val && "columns" in val) return val;
  return null;
}

export async function executeSeedDefinition(def: SeedDefinition): Promise<void> {
  const { db, schema, blueprints, shouldTruncateAll } = def;

  // Extract table definitions from schema object
  const tableEntries: Array<{ name: string; config: any }> = [];
  for (const [key, val] of Object.entries(schema)) {
    const config = extractTableConfig(val);
    if (config && config.name && config.columns) {
      tableEntries.push({ name: config.name, config });
    }
  }

  if (tableEntries.length === 0) {
    p.log.warn(pc.yellow("No valid tables found in schema object."));
    return;
  }

  const tableConfigs = tableEntries.map((t) => t.config);
  const sortedTables = topoSortConfigs(tableConfigs);

  const rawSql = db?.raw ? db : (db?.sql ? db.sql : (db?.client ? db.client : db));
  const isBunSql = typeof rawSql?.unsafe === "function";

  const executeSql = async (queryStr: string, params: any[] = []) => {
    if (db.raw) return await db.raw(queryStr, params);
    if (isBunSql) return await rawSql.unsafe(queryStr, params);
    throw new Error("Unsupported DB client passed to defineSeed. Expected Bungres ORM client or Bun.SQL instance.");
  };

  // Truncate if requested
  if (shouldTruncateAll) {
    const tableNames = sortedTables.map((t) => `"${t.schema || "public"}"."${t.name}"`).join(", ");
    if (tableNames) {
      await executeSql(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
      p.log.info(pc.gray("✓ Cleaned existing table data."));
    }
  }

  const insertedData: Record<string, any[]> = {};

  for (const table of sortedTables) {
    const bp = blueprints.get(table.name);
    const rowsToInsert = bp ? bp._count : 10;
    const customCols = bp ? bp._columns : {};

    if (bp && bp._shouldTruncate && !shouldTruncateAll) {
      await executeSql(`TRUNCATE TABLE "${table.schema || "public"}"."${table.name}" RESTART IDENTITY CASCADE;`);
    }

    const rows: any[] = [];
    const seenCompositeKeys = new Set<string>();

    for (let i = 0; i < rowsToInsert; i++) {
      let row: Record<string, any> = {};
      let attempts = 0;
      let isDuplicate = false;

      do {
        isDuplicate = false;
        row = {};

        for (const [colKey, col] of Object.entries(table.columns as Record<string, any>)) {
          const dbColName = col.name || colKey;

          // Check custom column definition first
          if (customCols && dbColName in customCols) {
            const valDef = customCols[dbColName];
            if (typeof valDef === "function") {
              row[dbColName] = valDef(i + attempts);
            } else if (valDef && typeof valDef === "object" && valDef.__isRel) {
              const parentRows = insertedData[valDef.tableName];
              if (parentRows && parentRows.length > 0) {
                const pRow = parentRows[Math.floor(Math.random() * parentRows.length)];
                row[dbColName] = pRow[valDef.colName];
              } else {
                row[dbColName] = null;
              }
            } else {
              row[dbColName] = valDef;
            }
            continue;
          }

          // Resolve FK
          if (col.references) {
            const parentTable = col.references.table;
            const parentRows = insertedData[parentTable];
            if (parentTable === table.name) {
              if (parentRows && parentRows.length > 0 && i >= 3) {
                const pRow = parentRows[Math.floor(Math.random() * parentRows.length)];
                row[dbColName] = pRow[col.references.column];
              } else {
                row[dbColName] = null;
              }
              continue;
            } else if (parentRows && parentRows.length > 0) {
              const pRow = parentRows[Math.floor(Math.random() * parentRows.length)];
              row[dbColName] = pRow[col.references.column];
              continue;
            }
          }

          // Auto-mock generator
          row[dbColName] = generateMockValue(col, i + attempts);
        }

        // Composite FK key uniqueness tracking (excluding primary key 'id')
        const fkKey = Object.keys(row)
          .filter((k) => k.toLowerCase() !== "id" && k.toLowerCase().endsWith("id"))
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

    // High-performance Batch Chunked Inserts (chunks of 500)
    const chunkSize = 500;
    const allInserted: any[] = [];

    for (let c = 0; c < rows.length; c += chunkSize) {
      const chunk = rows.slice(c, c + chunkSize);
      if (chunk.length === 0) continue;

      const keys = Object.keys(chunk[0]!).map((k) => `"${k}"`);
      const placeholders: string[] = [];
      const flatValues: any[] = [];
      let paramIdx = 1;

      for (const rowObj of chunk) {
        const rowPlaceholders: string[] = [];
        for (const k of Object.keys(chunk[0]!)) {
          let val = rowObj[k];
          if (Array.isArray(val)) {
            val = `{${val.map((item) => `"${String(item).replace(/"/g, '\\"')}"`).join(",")}}`;
          }
          flatValues.push(val);
          rowPlaceholders.push(`$${paramIdx++}`);
        }
        placeholders.push(`(${rowPlaceholders.join(", ")})`);
      }

      const q = `INSERT INTO "${table.schema || "public"}"."${table.name}" (${keys.join(", ")}) VALUES ${placeholders.join(", ")} RETURNING *`;
      const res = await executeSql(q, flatValues);
      if (Array.isArray(res)) {
        allInserted.push(...res);
      }
    }

    insertedData[table.name] = allInserted;
    p.log.success(`${pc.green("✓ Seeded")} ${rows.length} rows into ${pc.bold(table.name)}`);
  }

  p.log.message(pc.cyan("✨ Bungres Seeder execution complete."));
}

function generateMockValue(col: any, index: number): any {
  if (col.enumConfig && Array.isArray(col.enumConfig.enumValues) && col.enumConfig.enumValues.length > 0) {
    const vals = col.enumConfig.enumValues;
    return vals[index % vals.length];
  }

  const dt = (col.dataType || "").toLowerCase();
  const cName = (col.name || "").toLowerCase();
  const maxLen = typeof col.length === "number" ? col.length : undefined;

  const isUnique = !!(col.isUnique || col.unique || col.primaryKey || cName.includes("email") || cName.includes("slug") || cName.includes("sku"));
  const suffix = `_${crypto.randomUUID().slice(0, 8)}`;

  // Array handling
  if (dt.endsWith("[]")) {
    if (cName.includes("url") || cName.includes("image")) {
      return [
        `https://example.com/${col.name || "img"}_1${suffix}.jpg`,
        `https://example.com/${col.name || "img"}_2${suffix}.jpg`,
      ];
    }
    return [`${col.name || "val"}_1${suffix}`, `${col.name || "val"}_2${suffix}`];
  }

  if (cName.includes("currency") || maxLen === 3) {
    const currencies = ["USD", "EUR", "GBP", "JPY", "CAD"];
    return currencies[index % currencies.length];
  }

  let result: any = null;

  if (cName.includes("email")) {
    result = `user_${index + 1}${suffix}@example.com`;
  } else if (cName.includes("slug")) {
    result = `slug_${index + 1}${suffix}`;
  } else if (cName.includes("sku")) {
    result = `SKU-${index + 1}${suffix.toUpperCase()}`;
  } else if (cName.includes("url") || cName.includes("image")) {
    result = `https://example.com/${col.name || "item"}_${index + 1}${suffix}`;
  }

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

  if (typeof result === "string" && maxLen && result.length > maxLen) {
    result = result.slice(0, maxLen);
  }

  return result;
}
