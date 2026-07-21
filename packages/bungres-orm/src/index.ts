// ---------------------------------------------------------------------------
// @bungres/orm — public API
// ---------------------------------------------------------------------------

// Schema definition
export { alias, camelCase, getTableConfig, noCasing, snakeCase, pgTable, TableConfigSymbol } from "./schema/table.js";
export type { Table } from "./schema/table.js";

// Views
export { pgView, pgMaterializedView } from "./schema/view.js";
export type { ViewConfig } from "./schema/view.js";

// Constraints & Indexes
export { check, foreignKey, index, primaryKey, unique } from "./schema/indexes.js";
export type { CheckConstraintBuilder, ForeignKeyBuilder, IndexBuilder, PrimaryKeyBuilder } from "./schema/indexes.js";

// Column & Enum builders
export * from "./schema/columns.js";
export * from "./schema/enum.js";

// SQL helpers
export { colName, isSQLChunk, rawSql, sql, sqlJoin } from "./core/sql.js";
export type { SQLChunk } from "./core/sql.js";

// Query builders
export { DeleteBuilder } from "./builders/delete.js";
export { InsertBuilder } from "./builders/insert.js";
export { SelectBuilder, SelectBuilderIntermediate, type SelectedFields, type InferSelection } from "./builders/select.js";
export { UpdateBuilder } from "./builders/update.js";
export { withCte } from "./builders/cte.js";
export type { CTEBuilder } from "./builders/cte.js";

export {
  and, asc, between,
  desc, eq, gt,
  gte, ilike, inArray, isNotNull, isNull, like, lt,
  lte, ne, not, notInArray, or,
  containsJson, containedInJson, hasKey, hasAnyKeys, hasAllKeys, jsonExtract, jsonExtractText,
  arrayContains, arrayContained, arrayOverlaps,
  toTsquery, plainToTsquery, toTsvector, tsMatch
} from "./core/conditions.js";

export { count, sum, avg, min, max, over } from "./core/aggregations.js";

export type { OrderDir, QueryExecutor, WhereCondition } from "./core/query.js";

// DB client
export { BungresDB, BungresTransaction, bungres } from "./core/db.js";
export type { BungresDBClient, DBConfig } from "./core/db.js";

// Relational Query Builder
export type { RelationalQueryBuilder } from "./builders/relational.js";
export type { FindManyArgs, FindManyResult, SchemaConfig, WithConfig } from "./types/relations.js";

// DDL helpers (used by @bungres/kit, also exported for advanced users)
export {
  generateAddColumn, generateAddConstraint, generateCreateTable, generateDropColumn, generateDropConstraint, generateDropTable,
  generateCreateEnum, generateDropEnum, generateCreateView, generateDropView, inlineParams
} from "./ddl.js";

// Types
export type {
  ColumnConfig, ColumnDataType, ForeignKeyRef,
  IndexConfig, InferInsert, InferTable, TableConfig
} from "./types/index.js";

