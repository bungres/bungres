import type { ColumnConfig } from "../types/index.js";
import type { SQLChunk } from "./sql.js";
import { sql, sqlJoin, rawSql } from "./sql.js";

const colName = (c: string | ColumnConfig) => typeof c === "string" ? c : c.name;

export const eq = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" = ${value}`;

export const ne = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" != ${value}`;

export const gt = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" > ${value}`;

export const gte = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" >= ${value}`;

export const lt = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" < ${value}`;

export const lte = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" <= ${value}`;

export const like = (column: string | ColumnConfig, pattern: string): SQLChunk =>
  sql`"${rawSql(colName(column))}" LIKE ${pattern}`;

export const ilike = (column: string | ColumnConfig, pattern: string): SQLChunk =>
  sql`"${rawSql(colName(column))}" ILIKE ${pattern}`;

export const isNull = (column: string | ColumnConfig): SQLChunk =>
  rawSql(`"${colName(column)}" IS NULL`);

export const isNotNull = (column: string | ColumnConfig): SQLChunk =>
  rawSql(`"${colName(column)}" IS NOT NULL`);

export const inArray = (column: string | ColumnConfig, values: unknown[]): SQLChunk => {
  if (values.length === 0) return rawSql("FALSE");
  const params = values;
  const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `"${colName(column)}" = ANY(ARRAY[${placeholders}])`, params };
};

export const and = (...conditions: SQLChunk[]): SQLChunk =>
  sqlJoin(conditions, " AND ");

export const or = (...conditions: SQLChunk[]): SQLChunk => {
  const joined = sqlJoin(conditions, " OR ");
  return { sql: `(${joined.sql})`, params: joined.params };
};

export const not = (condition: SQLChunk): SQLChunk => ({
  sql: `NOT (${condition.sql})`,
  params: condition.params,
});

export const asc = (column: string | ColumnConfig): SQLChunk =>
  sql`"${rawSql(colName(column))}" ASC`;

export const desc = (column: string | ColumnConfig): SQLChunk =>
  sql`"${rawSql(colName(column))}" DESC`;
