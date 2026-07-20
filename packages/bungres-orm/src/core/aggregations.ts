import type { SQLChunk } from "./sql.js";
import { sql, rawSql, colName } from "./sql.js";
import type { ColumnConfig } from "../types/index.js";

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

export interface WindowOptions {
  partitionBy?: string | ColumnConfig | SQLChunk | Array<string | ColumnConfig | SQLChunk>;
  orderBy?: { column: string | ColumnConfig | SQLChunk; dir?: "asc" | "desc" } | Array<{ column: string | ColumnConfig | SQLChunk; dir?: "asc" | "desc" }>;
}

export const over = <T>(agg: SQLChunk<T>, options?: WindowOptions): SQLChunk<T> => {
  let partitionClause = "";
  let orderClause = "";

  const params = [...agg.params];
  let offset = params.length;

  if (options?.partitionBy) {
    const parts = Array.isArray(options.partitionBy) ? options.partitionBy : [options.partitionBy];
    const partitionSqls = parts.map((p) => {
      if (typeof p === "object" && p !== null && "sql" in p) {
        const chunk = p as SQLChunk;
        const currentOffset = offset;
        offset += chunk.params.length;
        params.push(...chunk.params);
        return chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + currentOffset}`);
      }
      return colName(p);
    });
    if (partitionSqls.length > 0) {
      partitionClause = `PARTITION BY ${partitionSqls.join(", ")}`;
    }
  }

  if (options?.orderBy) {
    const orders = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
    const orderSqls = orders.map((o) => {
      let colSql = "";
      if (typeof o.column === "object" && o.column !== null && "sql" in o.column) {
        const chunk = o.column as SQLChunk;
        const currentOffset = offset;
        offset += chunk.params.length;
        params.push(...chunk.params);
        colSql = chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + currentOffset}`);
      } else {
        colSql = colName(o.column);
      }
      return `${colSql} ${o.dir?.toUpperCase() ?? "ASC"}`;
    });
    if (orderSqls.length > 0) {
      orderClause = `ORDER BY ${orderSqls.join(", ")}`;
    }
  }

  const clauses = [partitionClause, orderClause].filter(Boolean).join(" ");
  
  return {
    sql: `${agg.sql} OVER (${clauses})`,
    params
  } as SQLChunk<T>;
};
