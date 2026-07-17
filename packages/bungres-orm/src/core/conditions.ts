import type { ColumnConfig, TableConfig } from "../types/index.js";
import type { SQLChunk } from "./sql.js";
import type { WhereObject, OrderByObject } from "./query.js";

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

export function parseWhereObject(tableConfig: TableConfig, whereObj: WhereObject<any>): SQLChunk {
  const conditions: SQLChunk[] = [];
  
  for (const [key, val] of Object.entries(whereObj)) {
    if (val === undefined) continue;
    
    if (key === "OR") {
      const orConditions = (val as WhereObject<any>[]).map(o => parseWhereObject(tableConfig, o));
      if (orConditions.length > 0) conditions.push(or(...orConditions));
      continue;
    }
    if (key === "AND") {
      const andConditions = (val as WhereObject<any>[]).map(o => parseWhereObject(tableConfig, o));
      if (andConditions.length > 0) conditions.push(and(...andConditions));
      continue;
    }
    if (key === "NOT") {
      conditions.push(not(parseWhereObject(tableConfig, val as WhereObject<any>)));
      continue;
    }

    const colConfig = tableConfig.columns[key];
    const columnName = colConfig ? colConfig.name : key;

    if (val !== null && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof Uint8Array)) {
      const opVal = val as any;
      if (opVal.eq !== undefined) conditions.push(eq(columnName, opVal.eq));
      if (opVal.ne !== undefined) conditions.push(ne(columnName, opVal.ne));
      if (opVal.gt !== undefined) conditions.push(gt(columnName, opVal.gt));
      if (opVal.gte !== undefined) conditions.push(gte(columnName, opVal.gte));
      if (opVal.lt !== undefined) conditions.push(lt(columnName, opVal.lt));
      if (opVal.lte !== undefined) conditions.push(lte(columnName, opVal.lte));
      if (opVal.in !== undefined) conditions.push(inArray(columnName, opVal.in));
      if (opVal.like !== undefined) conditions.push(like(columnName, opVal.like));
      if (opVal.ilike !== undefined) conditions.push(ilike(columnName, opVal.ilike));
      if (opVal.isNull) conditions.push(isNull(columnName));
      if (opVal.isNotNull) conditions.push(isNotNull(columnName));
    } else {
      if (val === null) {
        conditions.push(isNull(columnName));
      } else {
        conditions.push(eq(columnName, val));
      }
    }
  }

  if (conditions.length === 0) {
    return rawSql("TRUE");
  }

  return and(...conditions);
}

export function parseOrderByObject(tableConfig: TableConfig, orderByObj: OrderByObject<any>): SQLChunk[] {
  const parts: SQLChunk[] = [];
  
  for (const [key, dir] of Object.entries(orderByObj)) {
    if (dir === undefined) continue;
    const colConfig = tableConfig.columns[key];
    const columnName = colConfig ? colConfig.name : key;
    if (dir === "asc") parts.push(asc(columnName));
    else if (dir === "desc") parts.push(desc(columnName));
  }
  
  return parts;
}

