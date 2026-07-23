import type { ColumnConfig, IndexConfig, TableConfig } from "./types/index.js";
import type { ViewConfig } from "./schema/view.js";

// ---------------------------------------------------------------------------
// DDL generator — converts TableConfig into CREATE TABLE SQL
// Used by @bungres/kit for schema push/generate
// ---------------------------------------------------------------------------

export function generateCreateTable(config: TableConfig, ifNotExists = true): string {
  const tableName = config.schema
    ? `"${config.schema}"."${config.name}"`
    : `"${config.name}"`;

  const exists = ifNotExists ? " IF NOT EXISTS" : "";

  const columnDefs = Object.entries(config.columns).map(([key, col]) =>
    buildColumnDDL(key, col, config.name)
  );

  // Composite primary key
  if (config.primaryKeys && config.primaryKeys.length > 1) {
    const pkCols = config.primaryKeys.map((c) => `"${c}"`).join(", ");
    columnDefs.push(`PRIMARY KEY (${pkCols})`);
  }

  // Table-level check constraints
  if (config.checks) {
    for (const check of config.checks) {
      columnDefs.push(`CHECK (${check})`);
    }
  }

  let sql = `CREATE TABLE${exists} ${tableName} (\n  ${columnDefs.join(",\n  ")}\n);`;

  // Indexes (separate statements)
  if (config.indexes && config.indexes.length > 0) {
    sql += "\n\n" + config.indexes.map((idx) => buildIndex(config, idx)).join("\n");
  }

  return sql;
}

export function generateDropTable(config: TableConfig, ifExists = true): string {
  const tableName = config.schema
    ? `"${config.schema}"."${config.name}"`
    : `"${config.name}"`;
  return `DROP TABLE${ifExists ? " IF EXISTS" : ""} ${tableName};`;
}

export function generateAddConstraint(
  tableName: string,
  schema: string | undefined,
  constraintName: string,
  constraintDef: string
): string {
  const tbl = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  return `ALTER TABLE ${tbl} ADD CONSTRAINT "${constraintName}" ${constraintDef};`;
}

export function generateDropConstraint(
  tableName: string,
  schema: string | undefined,
  constraintName: string
): string {
  const tbl = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  return `ALTER TABLE ${tbl} DROP CONSTRAINT IF EXISTS "${constraintName}";`;
}

function buildColumnDDL(key: string, col: ColumnConfig, tableName: string): string {
  const name = `"${col.name || key}"`;
  let type = buildType(col);

  const parts: string[] = [`${name} ${type}`];

  // Single-column PK
  if (col.primaryKey && !["serial", "bigserial"].includes(col.dataType)) {
    parts.push("PRIMARY KEY");
  } else if (col.primaryKey) {
    parts.push("PRIMARY KEY");
  }

  if (col.notNull && !col.primaryKey && !["serial", "bigserial"].includes(col.dataType)) {
    parts.push("NOT NULL");
  }

  if (col.unique && !col.primaryKey) {
    parts.push("UNIQUE");
  }

  if (col.generatedAs) {
    parts.push(`GENERATED ALWAYS AS (${col.generatedAs}) STORED`);
  } else if (col.defaultFn) {
    parts.push(`DEFAULT ${col.defaultFn}`);
  } else if (col.defaultValue !== undefined) {
    parts.push(`DEFAULT ${formatDefaultValue(col.defaultValue, col.dataType)}`);
  }

  if (col.references) {
    const ref = col.references;
    const constraintName = `${tableName}_${col.name || key}_fkey`;
    let fk = `CONSTRAINT "${constraintName}" REFERENCES "${ref.table}"("${ref.column}")`;
    if (ref.onDelete) fk += ` ON DELETE ${ref.onDelete.toUpperCase()}`;
    if (ref.onUpdate) fk += ` ON UPDATE ${ref.onUpdate.toUpperCase()}`;
    parts.push(fk);
  }

  if (col.check) {
    parts.push(`CHECK (${col.check})`);
  }

  return parts.join(" ");
}

function buildType(col: ColumnConfig & { length?: number }): string {
  if (col.enumConfig) {
    return `"${col.enumConfig.enumName}"`;
  }

  if (col.dataType.endsWith("[]")) {
    const baseType = buildType({ ...col, dataType: col.dataType.slice(0, -2) as any });
    return `${baseType}[]`;
  }

  switch (col.dataType) {
    case "varchar":
      return col.length ? `VARCHAR(${col.length})` : "VARCHAR";
    case "char":
      return col.length ? `CHAR(${col.length})` : "CHAR";
    case "numeric":
    case "decimal":
      return col.dataType.toUpperCase();
    case "double precision":
      return "DOUBLE PRECISION";
    case "timestamptz":
      return "TIMESTAMP WITH TIME ZONE";
    case "timetz":
      return "TIME WITH TIME ZONE";
    default:
      return col.dataType.toUpperCase();
  }
}

function formatDefaultValue(value: unknown, dataType: ColumnConfig["dataType"]): string {
  if (value === null) return "NULL";
  if (typeof value === "string") {
    // boolean-like strings
    if (dataType === "boolean") return value;
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Array.isArray(value)) {
    if (dataType === "json" || dataType === "jsonb") {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    const pgArray = '{' + value.map(item => {
      if (item === null || item === undefined) return 'NULL';
      if (typeof item === 'string') return '"' + item.replace(/"/g, '\\"') + '"';
      return typeof item === 'object' ? '"' + JSON.stringify(item).replace(/"/g, '\\"').replace(/'/g, "''") + '"' : String(item);
    }).join(',') + '}';
    return `'${pgArray.replace(/'/g, "''")}'`;
  }
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

function buildIndex(table: TableConfig, idx: IndexConfig): string {
  const tableName = table.schema
    ? `"${table.schema}"."${table.name}"`
    : `"${table.name}"`;

  const unique = idx.unique ? "UNIQUE " : "";
  const using = idx.using ? ` USING ${idx.using.toUpperCase()}` : "";
  const cols = idx.columns.map((c) => `"${c}"`).join(", ");
  const where = idx.where ? ` WHERE ${idx.where}` : "";
  const idxName = idx.name ?? `idx_${table.name}_${idx.columns.join("_")}`;

  return `CREATE ${unique}INDEX IF NOT EXISTS "${idxName}" ON ${tableName}${using} (${cols})${where};`;
}

/** Generate ALTER TABLE ADD COLUMN statement */
export function generateAddColumn(
  tableName: string,
  schema: string | undefined,
  key: string,
  col: ColumnConfig
): string {
  const tbl = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  return `ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS ${buildColumnDDL(key, col, tableName)};`;
}

/** Generate ALTER TABLE DROP COLUMN statement */
export function generateDropColumn(
  tableName: string,
  schema: string | undefined,
  columnName: string
): string {
  const tbl = schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  return `ALTER TABLE ${tbl} DROP COLUMN IF EXISTS "${columnName}";`;
}

/** Generate CREATE TYPE ... AS ENUM statement */
export function generateCreateEnum(name: string, values: string[]): string {
  const vals = values.map(v => `'${v.replace(/'/g, "''")}'`).join(", ");
  return `CREATE TYPE "${name}" AS ENUM (${vals});`;
}

/** Generate DROP TYPE statement */
export function generateDropEnum(name: string, ifExists = true): string {
  return `DROP TYPE${ifExists ? " IF EXISTS" : ""} "${name}";`;
}

/** Inlines parameters into a SQL string for DDL generation where $1 parameters are not allowed */
export function inlineParams(chunk: { sql: string; params: unknown[] }): string {
  let { sql, params } = chunk;
  return sql.replace(/\$(\d+)/g, (_, n) => {
    const p = params[parseInt(n) - 1];
    if (typeof p === "string") return `'${p.replace(/'/g, "''")}'`;
    if (typeof p === "number") return String(p);
    if (typeof p === "boolean") return p ? "TRUE" : "FALSE";
    if (p === null) return "NULL";
    // fallback
    return `'${String(p).replace(/'/g, "''")}'`;
  });
}

/** Generate CREATE VIEW statement */
export function generateCreateView(view: any): string {
  const kind = view.materialized ? "MATERIALIZED VIEW" : "VIEW";
  let inlineSql = "";
  if (view.sql) {
    inlineSql = view.sql;
  } else if (view.query && typeof view.query.toSQL === "function") {
    inlineSql = inlineParams(view.query.toSQL());
  } else {
    inlineSql = "SELECT * FROM (VALUES ('LEGACY_SNAPSHOT_MISSING_SQL')) AS t(c)";
  }
  return `CREATE ${kind} "${view.name}" AS ${inlineSql};`;
}

/** Generate DROP VIEW statement */
export function generateDropView(view: ViewConfig, ifExists = true): string {
  const kind = view.materialized ? "MATERIALIZED VIEW" : "VIEW";
  return `DROP ${kind}${ifExists ? " IF EXISTS" : ""} "${view.name}";`;
}
