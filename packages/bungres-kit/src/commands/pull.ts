import { resolve, join } from "node:path";
import type { ResolvedConfig } from "../config.js";

// ---------------------------------------------------------------------------
// pull — introspect a live Postgres database and generate schema TypeScript
// Reads information_schema + pg_indexes to reconstruct table definitions
// ---------------------------------------------------------------------------

interface PgColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

interface PgConstraint {
  table_name: string;
  column_name: string;
  constraint_type: string;
  foreign_table: string | null;
  foreign_column: string | null;
  delete_rule: string | null;
  update_rule: string | null;
}

interface PgIndex {
  tablename: string;
  indexname: string;
  indexdef: string;
}

export async function introspectDb(
  sql: any, // Bun.SQL
  dbSchema: string
): Promise<Map<string, TableInfo>> {
  // Fetch columns
  const columns = await sql.unsafe(
    `SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length
    FROM information_schema.columns c
    WHERE c.table_schema = $1
      AND c.table_name NOT IN ('__bungres_migrations', '__bungres_push')
    ORDER BY c.table_name, c.ordinal_position`,
    [dbSchema]
  ) as unknown as PgColumn[];

  // Fetch constraints (PK, FK, UNIQUE)
  const constraints = await sql.unsafe(
    `SELECT
      tc.table_name,
      kcu.column_name,
      tc.constraint_type,
      ccu.table_name  AS foreign_table,
      ccu.column_name AS foreign_column,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    LEFT JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.table_schema = $1`,
    [dbSchema]
  ) as unknown as PgConstraint[];

  // Fetch indexes
  const indexes = await sql.unsafe(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = $1`,
    [dbSchema]
  ) as unknown as PgIndex[];

  // Group by table
  return groupByTable(columns, constraints, indexes);
}

export async function runPull(config: ResolvedConfig): Promise<void> {
  console.log("@bungres/kit pull: introspecting database...");

  const sql = new Bun.SQL(config.dbUrl);

  try {
    const dbSchema = config.dbSchema;
    const tableMap = await introspectDb(sql, dbSchema);

    if (tableMap.size === 0) {
      console.log("No tables found in schema:", dbSchema);
      return;
    }

    // Generate TypeScript
    const outDir = resolve(config.outDir);
    await Bun.$`mkdir -p ${outDir}`.quiet();

    const outPath = join(outDir, "schema.ts");
    const code = generateSchemaTS(tableMap, dbSchema);

    await Bun.write(outPath, code);
    console.log(`Generated schema: ${outPath}`);
    console.log(`  Tables: ${[...tableMap.keys()].join(", ")}`);
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

export interface TableInfo {
  tableName: string;
  columns: Array<{
    name: string;
    dataType: string;
    udtName: string;
    isNullable: boolean;
    columnDefault: string | null;
    maxLength: number | null;
    isPrimary: boolean;
    isUnique: boolean;
    foreignTable: string | undefined;
    foreignColumn: string | undefined;
    deleteRule: string | undefined;
    updateRule: string | undefined;
  }>;
  indexes: PgIndex[];
}

function groupByTable(
  columns: PgColumn[],
  constraints: PgConstraint[],
  indexes: PgIndex[]
): Map<string, TableInfo> {
  const map = new Map<string, TableInfo>();

  for (const col of columns) {
    if (!map.has(col.table_name)) {
      map.set(col.table_name, {
        tableName: col.table_name,
        columns: [],
        indexes: indexes.filter((i) => i.tablename === col.table_name),
      });
    }

    const tableConstraints = constraints.filter(
      (c) => c.table_name === col.table_name && c.column_name === col.column_name
    );

    const pkConstraint = tableConstraints.find((c) => c.constraint_type === "PRIMARY KEY");
    const uniqueConstraint = tableConstraints.find((c) => c.constraint_type === "UNIQUE");
    const fkConstraint = tableConstraints.find((c) => c.constraint_type === "FOREIGN KEY");

    map.get(col.table_name)!.columns.push({
      name: col.column_name,
      dataType: col.data_type,
      udtName: col.udt_name,
      isNullable: col.is_nullable === "YES",
      columnDefault: col.column_default,
      maxLength: col.character_maximum_length,
      isPrimary: !!pkConstraint,
      isUnique: !!uniqueConstraint,
      foreignTable: fkConstraint?.foreign_table ?? undefined,
      foreignColumn: fkConstraint?.foreign_column ?? undefined,
      deleteRule: fkConstraint?.delete_rule ?? undefined,
      updateRule: fkConstraint?.update_rule ?? undefined,
    });
  }

  return map;
}

function generateSchemaTS(
  tableMap: Map<string, TableInfo>,
  dbSchema: string
): string {
  const lines: string[] = [
    `// Generated by @bungres/kit pull`,
    `// Do not edit manually — re-run \`bungres pull\` to regenerate`,
    `// Generated at: ${new Date().toISOString()}`,
    ``,
    `import {`,
    `  snakeCase,`,
    `  text, varchar, char, integer, bigint, smallint,`,
    `  serial, bigserial, boolean, real, doublePrecision,`,
    `  numeric, decimal, json, jsonb,`,
    `  timestamp, timestamptz, date, time, uuid,`,
    `  bytea, inet,`,
    `  textArray, integerArray, varcharArray, uuidArray,`,
    `} from "@bungres/orm";`,
    ``,
  ];

  for (const [, table] of tableMap) {
    const varName = toCamelCase(table.tableName);
    lines.push(`export const ${varName} = snakeCase.table("${table.tableName}", {`);

    for (const col of table.columns) {
      const colExpr = buildColumnExpression(col);
      lines.push(`  ${toCamelCase(col.name)}: ${colExpr},`);
    }

    // Third argument: Table options (schema, indexes)
    const options: string[] = [];
    if (dbSchema !== "public") {
      options.push(`schema: "${dbSchema}"`);
    }

    if (table.indexes.length > 0) {
      const idxLines: string[] = [];
      for (const idx of table.indexes) {
        // Simple regex to parse `indexdef`
        // e.g. CREATE UNIQUE INDEX my_idx ON users USING btree (col1, col2) WHERE col3 = 1
        const m = idx.indexdef.match(/CREATE (UNIQUE )?INDEX (.+) ON (.+) USING (\w+) \((.+)\)(?: WHERE (.+))?/i);
        if (m) {
          const isUnique = !!m[1];
          const name = m[2]!.trim().replace(/^"|"$/g, "");
          // Skip auto-generated PK and UNIQUE constraint indexes which are already attached to columns
          if (name.endsWith("_pkey") || name.endsWith("_key")) continue;
          
          const using = m[4]!.toLowerCase();
          const cols = m[5]!.split(",").map(c => `"${c.trim().replace(/^"|"$/g, "")}"`);
          let idxStr = `{ name: "${name}", columns: [${cols.join(", ")}], using: "${using}"`;
          if (isUnique) idxStr += `, unique: true`;
          if (m[6]) idxStr += `, where: \`${m[6].trim()}\``;
          idxStr += ` }`;
          idxLines.push(idxStr);
        }
      }
      if (idxLines.length > 0) {
        options.push(`indexes: [\n    ${idxLines.join(",\n    ")}\n  ]`);
      }
    }

    if (options.length > 0) {
      lines.push(`}, {`);
      lines.push(`  ${options.join(",\n  ")}`);
      lines.push(`});`);
    } else {
      lines.push(`});`);
    }

    lines.push(``);
  }

  return lines.join("\n");
}

function buildColumnExpression(col: TableInfo["columns"][number]): string {
  const opts: string[] = [];

  if (col.dataType === "character varying" || col.dataType === "character") {
    if (col.maxLength) opts.push(`length: ${col.maxLength}`);
  }

  if (col.isPrimary) opts.push(`primaryKey: true`);
  else if (!col.isNullable) opts.push(`notNull: true`);

  if (col.isUnique && !col.isPrimary) opts.push(`unique: true`);

  if (col.columnDefault !== null && !col.isPrimary) {
    if (col.columnDefault.includes("(")) {
      opts.push(`defaultRaw: "${col.columnDefault}"`);
    } else if (col.dataType === "boolean" || col.dataType.includes("int") || col.dataType.includes("numeric") || col.dataType.includes("real") || col.dataType.includes("double")) {
      opts.push(`default: ${col.columnDefault}`);
    } else {
      const cleaned = col.columnDefault.replace(/^'(.*)'::.*$/, "$1");
      opts.push(`default: "${cleaned}"`);
    }
  }

  if (col.foreignTable && col.foreignColumn) {
    const deleteRule = col.deleteRule?.toLowerCase().replace(" ", " ");
    const updateRule = col.updateRule?.toLowerCase().replace(" ", " ");
    let refOpts = `table: "${col.foreignTable}", column: "${col.foreignColumn}"`;
    if (deleteRule && deleteRule !== "no action") refOpts += `, onDelete: "${deleteRule}"`;
    if (updateRule && updateRule !== "no action") refOpts += `, onUpdate: "${updateRule}"`;
    opts.push(`references: { ${refOpts} }`);
  }

  let builderName = pgTypeToBungresBuilderName(col);
  
  if (opts.length > 0) {
    return `${builderName}({ ${opts.join(", ")} })`;
  }
  return `${builderName}()`;
}

function pgTypeToBungresBuilderName(col: TableInfo["columns"][number]): string {
  const dt = col.dataType;

  if (dt === "uuid") return "uuid";
  if (dt === "text") return "text";
  if (dt === "character varying") return "varchar";
  if (dt === "character") return "char";
  if (dt === "integer") return "integer";
  if (dt === "bigint") return "bigint";
  if (dt === "smallint") return "smallint";
  if (dt === "boolean") return "boolean";
  if (dt === "real") return "real";
  if (dt === "double precision") return "doublePrecision";
  if (dt === "numeric" || dt === "decimal") return "numeric";
  if (dt === "json") return "json";
  if (dt === "jsonb") return "jsonb";
  if (dt === "timestamp without time zone") return "timestamp";
  if (dt === "timestamp with time zone") return "timestamptz";
  if (dt === "date") return "date";
  if (dt === "time without time zone") return "time";
  if (dt === "bytea") return "bytea";
  if (dt === "inet") return "inet";
  if (dt === "USER-DEFINED" && col.udtName === "citext") return "text";
  if (dt === "ARRAY") {
    if (col.udtName === "_text") return "textArray";
    if (col.udtName === "_int4" || col.udtName === "_int8") return "integerArray";
    if (col.udtName === "_varchar") return "varcharArray";
    if (col.udtName === "_uuid") return "uuidArray";
    return "textArray";
  }
  // Fallback
  return "text";
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
