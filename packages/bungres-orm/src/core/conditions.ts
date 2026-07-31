import type { ColumnConfig, TableConfig } from "../types/index.js";
import type { SQLChunk } from "./sql.js";
import type { WhereObject, OrderByObject } from "./query.js";

import { sql, sqlJoin, rawSql, colName } from "./sql.js";

import { isSQLChunk } from "./sql.js";

function isColumnConfig(val: unknown): val is ColumnConfig {
  return val !== null && typeof val === "object" && "name" in val && "dataType" in val;
}

export const eq = (column: string | ColumnConfig | SQLChunk, value: unknown): SQLChunk => {
  if (isColumnConfig(value)) return sql`${rawSql(colName(column))} = ${rawSql(colName(value))}`;
  if (isSQLChunk(value)) return sql`${rawSql(colName(column))} = ${value}`;
  return sql`${rawSql(colName(column))} = ${value}`;
};

export const ne = (column: string | ColumnConfig | SQLChunk, value: unknown): SQLChunk => {
  if (isColumnConfig(value)) return sql`${rawSql(colName(column))} != ${rawSql(colName(value))}`;
  if (isSQLChunk(value)) return sql`${rawSql(colName(column))} != ${value}`;
  return sql`${rawSql(colName(column))} != ${value}`;
};

export const gt = (column: string | ColumnConfig | SQLChunk, value: unknown): SQLChunk => {
  if (isColumnConfig(value)) return sql`${rawSql(colName(column))} > ${rawSql(colName(value))}`;
  if (isSQLChunk(value)) return sql`${rawSql(colName(column))} > ${value}`;
  return sql`${rawSql(colName(column))} > ${value}`;
};

export const gte = (column: string | ColumnConfig | SQLChunk, value: unknown): SQLChunk => {
  if (isColumnConfig(value)) return sql`${rawSql(colName(column))} >= ${rawSql(colName(value))}`;
  if (isSQLChunk(value)) return sql`${rawSql(colName(column))} >= ${value}`;
  return sql`${rawSql(colName(column))} >= ${value}`;
};

export const lt = (column: string | ColumnConfig | SQLChunk, value: unknown): SQLChunk => {
  if (isColumnConfig(value)) return sql`${rawSql(colName(column))} < ${rawSql(colName(value))}`;
  if (isSQLChunk(value)) return sql`${rawSql(colName(column))} < ${value}`;
  return sql`${rawSql(colName(column))} < ${value}`;
};

export const lte = (column: string | ColumnConfig | SQLChunk, value: unknown): SQLChunk => {
  if (isColumnConfig(value)) return sql`${rawSql(colName(column))} <= ${rawSql(colName(value))}`;
  if (isSQLChunk(value)) return sql`${rawSql(colName(column))} <= ${value}`;
  return sql`${rawSql(colName(column))} <= ${value}`;
};

export const like = (column: string | ColumnConfig | SQLChunk, pattern: string): SQLChunk =>
  sql`${rawSql(colName(column))} LIKE ${pattern}`;

export const ilike = (column: string | ColumnConfig | SQLChunk, pattern: string): SQLChunk =>
  sql`${rawSql(colName(column))} ILIKE ${pattern}`;

export const isNull = (column: string | ColumnConfig | SQLChunk): SQLChunk =>
  rawSql(`${colName(column)} IS NULL`);

export const isNotNull = (column: string | ColumnConfig | SQLChunk): SQLChunk =>
  rawSql(`${colName(column)} IS NOT NULL`);

export const inArray = (column: string | ColumnConfig, values: unknown[] | { toSQL(): SQLChunk } | SQLChunk): SQLChunk => {
  if (isSQLChunk(values)) {
    return sql`${rawSql(colName(column))} IN (${values})`;
  }
  if (typeof values === "object" && values !== null && "toSQL" in values) {
    return sql`${rawSql(colName(column))} IN (${values.toSQL()})`;
  }
  const arr = values as unknown[];
  if (arr.length === 0) return rawSql("FALSE");
  const params = arr;
  const placeholders = arr.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `${colName(column)} IN (${placeholders})`, params };
};

export const notInArray = (column: string | ColumnConfig, values: unknown[] | { toSQL(): SQLChunk } | SQLChunk): SQLChunk => {
  if (isSQLChunk(values)) {
    return sql`${rawSql(colName(column))} NOT IN (${values})`;
  }
  if (typeof values === "object" && values !== null && "toSQL" in values) {
    return sql`${rawSql(colName(column))} NOT IN (${values.toSQL()})`;
  }
  const arr = values as unknown[];
  if (arr.length === 0) return rawSql("TRUE");
  const params = arr;
  const placeholders = arr.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `${colName(column)} NOT IN (${placeholders})`, params };
};

export const between = (column: string | ColumnConfig | SQLChunk, min: unknown, max: unknown): SQLChunk =>
  sql`${rawSql(colName(column))} BETWEEN ${min} AND ${max}`;

export const startsWith = (column: string | ColumnConfig | SQLChunk, prefix: string): SQLChunk =>
  sql`${rawSql(colName(column))} LIKE ${prefix + "%"}`;

export const endsWith = (column: string | ColumnConfig | SQLChunk, suffix: string): SQLChunk =>
  sql`${rawSql(colName(column))} LIKE ${"%" + suffix}`;

export const contains = (column: string | ColumnConfig | SQLChunk, substring: string): SQLChunk =>
  sql`${rawSql(colName(column))} LIKE ${"%" + substring + "%"}`;

export const betweenDate = (column: string | ColumnConfig | SQLChunk, start: Date, end: Date): SQLChunk =>
  sql`${rawSql(colName(column))} BETWEEN ${start} AND ${end}`;

export const and = (...conditions: SQLChunk[]): SQLChunk =>
  sqlJoin(conditions, " AND ");

export const or = (...conditions: SQLChunk[]): SQLChunk => {
  if (conditions.length === 0) return rawSql("FALSE");
  const joined = sqlJoin(conditions, " OR ");
  return { sql: `(${joined.sql})`, params: joined.params };
};

export const not = (condition: SQLChunk): SQLChunk => ({
  sql: `NOT (${condition.sql})`,
  params: condition.params,
});

export const asc = (column: string | ColumnConfig): SQLChunk =>
  sql`${rawSql(colName(column))} ASC`;

export const desc = (column: string | ColumnConfig): SQLChunk =>
  sql`${rawSql(colName(column))} DESC`;

export function parseWhereObject(tableConfig: TableConfig, whereObj: WhereObject<Record<string, ColumnConfig>>, alias?: string): SQLChunk {
  const conditions: SQLChunk[] = [];
  
  for (const [key, val] of Object.entries(whereObj)) {
    if (val === undefined) continue;
    
    if (key === "OR") {
      const orConditions = (val as WhereObject<Record<string, ColumnConfig>>[]).map(o => parseWhereObject(tableConfig, o, alias));
      if (orConditions.length > 0) conditions.push(or(...orConditions));
      continue;
    }
    if (key === "AND") {
      const andConditions = (val as WhereObject<Record<string, ColumnConfig>>[]).map(o => parseWhereObject(tableConfig, o, alias));
      if (andConditions.length > 0) conditions.push(and(...andConditions));
      continue;
    }
    if (key === "NOT") {
      conditions.push(not(parseWhereObject(tableConfig, val as WhereObject<Record<string, ColumnConfig>>, alias)));
      continue;
    }

    const colConfig = tableConfig.columns[key];
    const columnArg = (colConfig 
      ? (alias ? { ...colConfig, tableName: alias } : colConfig) 
      : (alias ? { name: key, tableName: alias } : key)) as unknown as ColumnConfig;

    if (isSQLChunk(val)) {
      conditions.push(eq(columnArg, val));
    } else if (val !== null && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof Uint8Array)) {
      const opVal = val as Record<string, unknown>;
      if (opVal.eq !== undefined) conditions.push(eq(columnArg, opVal.eq));
      if (opVal.ne !== undefined) conditions.push(ne(columnArg, opVal.ne));
      if (opVal.gt !== undefined) conditions.push(gt(columnArg, opVal.gt));
      if (opVal.gte !== undefined) conditions.push(gte(columnArg, opVal.gte));
      if (opVal.lt !== undefined) conditions.push(lt(columnArg, opVal.lt));
      if (opVal.lte !== undefined) conditions.push(lte(columnArg, opVal.lte));
      if (opVal.in !== undefined) conditions.push(inArray(columnArg, opVal.in as unknown[]));
      if (opVal.notIn !== undefined) conditions.push(notInArray(columnArg, opVal.notIn as unknown[]));
      if (opVal.between !== undefined) conditions.push(between(columnArg, (opVal.between as unknown[])[0], (opVal.between as unknown[])[1]));
      if (opVal.like !== undefined) conditions.push(like(columnArg, opVal.like as string));
      if (opVal.ilike !== undefined) conditions.push(ilike(columnArg, opVal.ilike as string));
      if (opVal.isNull) conditions.push(isNull(columnArg));
      if (opVal.isNotNull) conditions.push(isNotNull(columnArg));
    } else {
      if (val === null) {
        conditions.push(isNull(columnArg));
      } else {
        conditions.push(eq(columnArg, val));
      }
    }
  }

  if (conditions.length === 0) {
    return rawSql("TRUE");
  }

  return and(...conditions);
}

export function parseOrderByObject(tableConfig: TableConfig, orderByObj: OrderByObject<Record<string, ColumnConfig>>, alias?: string): SQLChunk[] {
  const parts: SQLChunk[] = [];
  
  for (const [key, dir] of Object.entries(orderByObj)) {
    if (dir === undefined) continue;
    const colConfig = tableConfig.columns[key];
    const columnArg = (colConfig 
      ? (alias ? { ...colConfig, tableName: alias } : colConfig) 
      : (alias ? { name: key, tableName: alias } : key)) as unknown as ColumnConfig;
    if (dir === "asc") parts.push(asc(columnArg));
    else if (dir === "desc") parts.push(desc(columnArg));
  }
  
  return parts;
}

// ---------------------------------------------------------------------------
// Postgres JSONB Operators
// ---------------------------------------------------------------------------

export const containsJson = (column: string | ColumnConfig | SQLChunk, value: unknown): SQLChunk =>
  sql`${rawSql(colName(column))} @> ${value}::jsonb`;

export const containedInJson = (column: string | ColumnConfig | SQLChunk, value: unknown): SQLChunk =>
  sql`${rawSql(colName(column))} <@ ${value}::jsonb`;

export const hasKey = (column: string | ColumnConfig | SQLChunk, key: string): SQLChunk =>
  sql`${rawSql(colName(column))} ? ${key}`;

export const hasAnyKeys = (column: string | ColumnConfig | SQLChunk, keys: string[]): SQLChunk => {
  if (keys.length === 0) return rawSql("FALSE");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `${colName(column)} ?| ARRAY[${placeholders}]`, params: keys };
};

export const hasAllKeys = (column: string | ColumnConfig | SQLChunk, keys: string[]): SQLChunk => {
  if (keys.length === 0) return rawSql("TRUE");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `${colName(column)} ?& ARRAY[${placeholders}]`, params: keys };
};

export const jsonExtractText = (column: string | ColumnConfig | SQLChunk, path: string | number): SQLChunk =>
  sql`${rawSql(colName(column))} ->> ${path.toString()}`;

export const jsonExtract = (column: string | ColumnConfig | SQLChunk, path: string | number): SQLChunk =>
  sql`${rawSql(colName(column))} -> ${path.toString()}`;

// ---------------------------------------------------------------------------
// Postgres Array Operators
// ---------------------------------------------------------------------------

export const arrayContains = (column: string | ColumnConfig | SQLChunk, values: unknown[]): SQLChunk => {
  if (values.length === 0) return rawSql(`${colName(column)} @> ARRAY[]::text[]`); // fallback
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `${colName(column)} @> ARRAY[${placeholders}]`, params: values };
};

export const arrayContained = (column: string | ColumnConfig | SQLChunk, values: unknown[]): SQLChunk => {
  if (values.length === 0) return rawSql(`${colName(column)} <@ ARRAY[]::text[]`);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `${colName(column)} <@ ARRAY[${placeholders}]`, params: values };
};

export const arrayOverlaps = (column: string | ColumnConfig | SQLChunk, values: unknown[]): SQLChunk => {
  if (values.length === 0) return rawSql("FALSE");
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `${colName(column)} && ARRAY[${placeholders}]`, params: values };
};

// ---------------------------------------------------------------------------
// Full Text Search
// ---------------------------------------------------------------------------

export const toTsquery = (query: string): SQLChunk => sql`to_tsquery(${query})`;
export const plainToTsquery = (query: string): SQLChunk => sql`plainto_tsquery(${query})`;

export const toTsvector = (column: string | ColumnConfig | SQLChunk, config?: string): SQLChunk => {
  if (config) {
    return sql`to_tsvector(${config}::regconfig, ${rawSql(colName(column))})`;
  }
  return sql`to_tsvector(${rawSql(colName(column))})`;
};

export const tsMatch = (vector: string | ColumnConfig | SQLChunk, query: string | SQLChunk): SQLChunk => {
  if (typeof query === "string") {
    return sql`${rawSql(colName(vector))} @@ plainto_tsquery(${query})`;
  }
  return sql`${rawSql(colName(vector))} @@ ${query}`;
};
