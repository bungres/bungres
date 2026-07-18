import type { SQLChunk } from "./sql.js";
import type { InferColumnType, ColumnConfig } from "../types/index.js";

export interface QueryExecutor {
  execute<T>(builder: { toSQL(): SQLChunk } | SQLChunk): Promise<T[]>;
  executeSingle<T>(builder: { toSQL(): SQLChunk } | SQLChunk): Promise<T | null>;
}

export type WhereObject<TColumns extends Record<string, ColumnConfig<any, any, any, any>>> = {
  [K in keyof TColumns]?: InferColumnType<TColumns[K]> | {
    eq?: InferColumnType<TColumns[K]>;
    ne?: InferColumnType<TColumns[K]>;
    gt?: InferColumnType<TColumns[K]>;
    gte?: InferColumnType<TColumns[K]>;
    lt?: InferColumnType<TColumns[K]>;
    lte?: InferColumnType<TColumns[K]>;
    in?: InferColumnType<TColumns[K]>[];
    notIn?: InferColumnType<TColumns[K]>[];
    between?: [InferColumnType<TColumns[K]>, InferColumnType<TColumns[K]>];
    like?: string;
    ilike?: string;
    isNull?: boolean;
    isNotNull?: boolean;
  };
} & {
  OR?: WhereObject<TColumns>[];
  AND?: WhereObject<TColumns>[];
  NOT?: WhereObject<TColumns>;
};

export type OrderDir = "asc" | "desc";

export type OrderByObject<TColumns extends Record<string, ColumnConfig<any, any, any, any>>> = {
  [K in keyof TColumns]?: OrderDir;
};

export type WhereCondition<TColumns extends Record<string, ColumnConfig<any, any, any, any>> = any> = SQLChunk | WhereObject<TColumns>;
