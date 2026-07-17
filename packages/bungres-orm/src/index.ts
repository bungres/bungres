// ---------------------------------------------------------------------------
// @bungres/orm — public API
// ---------------------------------------------------------------------------

// Schema definition
export { table, TableConfigSymbol, snakeCase, camelCase } from "./table.js";
export type { Table } from "./table.js";

// Column builders
export {
  text,
  varchar,
  char,
  integer,
  bigint,
  smallint,
  serial,
  bigserial,
  boolean,
  real,
  doublePrecision,
  numeric,
  decimal,
  json,
  jsonb,
  timestamp,
  timestamptz,
  date,
  time,
  timetz,
  uuid,
  bytea,
  interval,
  inet,
  cidr,
  macaddr,
} from "./column.js";
export * from "./column.js";

// SQL helpers
export { sql, rawSql, sqlJoin, isSQLChunk } from "./sql.js";
export type { SQLChunk } from "./sql.js";

// Query builders
export {
  SelectBuilder,
  InsertBuilder,
  UpdateBuilder,
  DeleteBuilder,
  // condition helpers
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  ilike,
  isNull,
  isNotNull,
  inArray,
  and,
  or,
  not,
  asc,
  desc,
} from "./query.js";

// DB client
export { BungresDB, BungresTransaction, createDB } from "./db.js";
export type { DBConfig, BungresDBClient } from "./db.js";

// Relational Query Builder
export type { RelationalQueryBuilder, FindManyArgs, FindManyResult, WithConfig, SchemaConfig } from "./relational.js";

// DDL helpers (used by @bungres/kit, also exported for advanced users)
export {
  generateCreateTable,
  generateDropTable,
  generateAddColumn,
  generateDropColumn,
  generateAddConstraint,
  generateDropConstraint,
} from "./ddl.js";

// Types
export type {
  ColumnDataType,
  ColumnConfig,
  ForeignKeyRef,
  IndexConfig,
  TableConfig,
  InferTable,
  InferInsert,
} from "./types.js";
