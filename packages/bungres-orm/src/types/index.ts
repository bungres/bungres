// ---------------------------------------------------------------------------
// Core type primitives used across @bungres/orm
// ---------------------------------------------------------------------------

/** All supported Postgres column data types */
export type ColumnDataType =
  | "text"
  | "varchar"
  | "char"
  | "integer"
  | "bigint"
  | "smallint"
  | "serial"
  | "bigserial"
  | "boolean"
  | "real"
  | "double precision"
  | "numeric"
  | "decimal"
  | "json"
  | "jsonb"
  | "timestamp"
  | "timestamptz"
  | "date"
  | "time"
  | "timetz"
  | "uuid"
  | "bytea"
  | "interval"
  | "inet"
  | "cidr"
  | "macaddr"
  | "point"
  | "line"
  | "lseg"
  | "box"
  | "path"
  | "polygon"
  | "circle"
  | "text[]"
  | "integer[]"
  | "varchar[]"
  | "uuid[]";

/** Column config stored internally */
export interface ColumnConfig<
  TDataType extends ColumnDataType = ColumnDataType,
  TNotNull extends boolean = boolean,
  TPrimaryKey extends boolean = boolean,
  TRef extends ForeignKeyRef | undefined = ForeignKeyRef | undefined
> {
  name: string;
  dataType: TDataType;
  notNull: TNotNull;
  primaryKey: TPrimaryKey;
  unique: boolean;
  defaultValue?: unknown;
  defaultFn?: string; // raw SQL default, e.g. "gen_random_uuid()"
  references?: TRef;
  check?: string;
  generated?: "always" | "by default"; // for identity columns
}

export interface ForeignKeyRef<
  TTable extends string = string,
  TColumn extends string = string,
  TRelationName extends string = string,
  TBackRelationName extends string = string
> {
  table: TTable;
  column: TColumn;
  relationName?: TRelationName;
  backRelationName?: TBackRelationName;
  onDelete?: "cascade" | "set null" | "set default" | "restrict" | "no action";
  onUpdate?: "cascade" | "set null" | "set default" | "restrict" | "no action";
}

/** Table index definition */
export interface IndexConfig {
  name?: string;
  columns: string[];
  unique?: boolean;
  where?: string; // partial index condition
  using?: "btree" | "hash" | "gin" | "gist" | "brin";
}

/** Table foreign key definition (table-level) */
export interface ForeignKeyConfig {
  name?: string;
  columns: string[];
  foreignTable: string;
  foreignColumns: string[];
  onDelete?: "cascade" | "set null" | "set default" | "restrict" | "no action";
  onUpdate?: "cascade" | "set null" | "set default" | "restrict" | "no action";
}

/** Table-level config */
export interface TableConfig {
  name: string;
  schema?: string;
  columns: Record<string, ColumnConfig>;
  primaryKeys?: string[];
  indexes?: IndexConfig[];
  foreignKeys?: ForeignKeyConfig[];
  checks?: string[];
}

// ---------------------------------------------------------------------------
// TypeScript type inference helpers — lets you derive TS types from a table
// ---------------------------------------------------------------------------

type IsNullable<C extends ColumnConfig<any, any, any, any>> = C["notNull"] extends true ? false : true;

type InferBaseType<C extends ColumnConfig<any, any, any, any>> = C["dataType"] extends
  | "text"
  | "varchar"
  | "char"
  | "uuid"
  | "inet"
  | "cidr"
  | "macaddr"
  ? string
  : C["dataType"] extends
      | "integer"
      | "bigint"
      | "smallint"
      | "serial"
      | "bigserial"
      | "real"
      | "double precision"
      | "numeric"
      | "decimal"
  ? number
  : C["dataType"] extends "boolean"
  ? boolean
  : C["dataType"] extends "json" | "jsonb"
  ? unknown
  : C["dataType"] extends "timestamp" | "timestamptz" | "date" | "time" | "timetz"
  ? Date
  : C["dataType"] extends "bytea"
  ? Uint8Array
  : C["dataType"] extends "text[]" | "varchar[]" | "uuid[]"
  ? string[]
  : C["dataType"] extends "integer[]"
  ? number[]
  : unknown;

export type InferColumnType<C extends ColumnConfig<any, any, any, any>> = IsNullable<C> extends true
  ? InferBaseType<C> | null
  : InferBaseType<C>;

/** Given a table's columns record, infer the full row type */
export type InferTable<T extends Record<string, ColumnConfig<any, any, any, any>>> = {
  [K in keyof T]: InferColumnType<T[K]>;
};

/** Partial version for inserts (nullable cols and cols with defaults are optional) */
export type InferInsert<T extends Record<string, ColumnConfig<any, any, any, any>>> = {
  [K in keyof T as T[K]["notNull"] extends true
    ? T[K]["defaultValue"] extends undefined
      ? T[K]["defaultFn"] extends undefined
        ? T[K]["primaryKey"] extends true
          ? never // PK serials are auto-generated
          : K
        : never
      : never
    : never]: InferBaseType<T[K]>;
} & {
  [K in keyof T as T[K]["notNull"] extends true
    ? T[K]["defaultValue"] extends undefined
      ? T[K]["defaultFn"] extends undefined
        ? T[K]["primaryKey"] extends true
          ? K
          : never
        : K
      : K
    : K]?: InferColumnType<T[K]>;
};
