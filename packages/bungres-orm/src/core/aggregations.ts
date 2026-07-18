import type { SQLChunk } from "./sql.js";
import { sql, rawSql } from "./sql.js";
import type { ColumnConfig } from "../types/index.js";

const colName = (c: string | ColumnConfig) => {
  if (typeof c === "string") return `"${c}"`;
  return c.tableName ? `${c.tableName}."${c.name}"` : `"${c.name}"`;
};

export const count = (column?: string | ColumnConfig): SQLChunk<number> => {
  if (!column) return rawSql<number>(`COUNT(*)`);
  return sql<number>`COUNT(${rawSql(colName(column))})`;
};

export const sum = (column: string | ColumnConfig): SQLChunk<number> =>
  sql<number>`SUM(${rawSql(colName(column))})`;

export const avg = (column: string | ColumnConfig): SQLChunk<number> =>
  sql<number>`AVG(${rawSql(colName(column))})`;

export const min = (column: string | ColumnConfig): SQLChunk<any> =>
  sql<any>`MIN(${rawSql(colName(column))})`;

export const max = (column: string | ColumnConfig): SQLChunk<any> =>
  sql<any>`MAX(${rawSql(colName(column))})`;
