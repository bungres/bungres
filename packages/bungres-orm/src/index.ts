// ---------------------------------------------------------------------------
// @bungres/orm — public API
// ---------------------------------------------------------------------------

// Schema definition
export { camelCase, getTableConfig, noCasing, snakeCase, table, TableConfigSymbol } from "./schema/table.js";
export type { Table } from "./schema/table.js";

// Constraints & Indexes
export { check, foreignKey, index, primaryKey, unique } from "./schema/indexes.js";
export type { CheckConstraintBuilder, ForeignKeyBuilder, IndexBuilder, PrimaryKeyBuilder } from "./schema/indexes.js";

// Column builders
export * from "./schema/columns.js";

// SQL helpers
export { colName, isSQLChunk, rawSql, sql, sqlJoin } from "./core/sql.js";
export type { SQLChunk } from "./core/sql.js";

// Query builders
export { DeleteBuilder } from "./builders/delete.js";
export { InsertBuilder } from "./builders/insert.js";
export { SelectBuilder, SelectBuilderIntermediate, type SelectedFields, type InferSelection } from "./builders/select.js";
export { UpdateBuilder } from "./builders/update.js";

export {
  and, asc, between,
  desc, eq, gt,
  gte, ilike, inArray, isNotNull, isNull, like, lt,
  lte, ne, not, notInArray, or
} from "./core/conditions.js";

export { count, sum, avg, min, max } from "./core/aggregations.js";

export type { OrderDir, QueryExecutor, WhereCondition } from "./core/query.js";

// DB client
export { BungresDB, BungresTransaction, bungres } from "./core/db.js";
export type { BungresDBClient, DBConfig } from "./core/db.js";

// Relational Query Builder
export type { RelationalQueryBuilder } from "./builders/relational.js";
export type { FindManyArgs, FindManyResult, SchemaConfig, WithConfig } from "./types/relations.js";

// DDL helpers (used by @bungres/kit, also exported for advanced users)
export {
  generateAddColumn, generateAddConstraint, generateCreateTable, generateDropColumn, generateDropConstraint, generateDropTable
} from "./ddl.js";

// Types
export type {
  ColumnConfig, ColumnDataType, ForeignKeyRef,
  IndexConfig, InferInsert, InferTable, TableConfig
} from "./types/index.js";

