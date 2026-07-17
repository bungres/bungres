import type { SQLChunk } from "./sql.js";

export interface QueryExecutor {
  execute<T>(builder: { toSQL(): SQLChunk } | SQLChunk): Promise<T[]>;
  executeSingle<T>(builder: { toSQL(): SQLChunk } | SQLChunk): Promise<T | null>;
}

export type WhereCondition = SQLChunk;
export type OrderDir = "asc" | "desc";
