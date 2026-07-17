import type { Table } from "../schema/table.js";
import type { InferTable } from "./index.js";
import type { SQLChunk } from "../core/sql.js";
import type { OrderByObject, WhereCondition } from "../core/query.js";

// ---------------------------------------------------------------------------
// Type-level schema extraction (Zero-Boilerplate Relations)
// ---------------------------------------------------------------------------

export type SchemaConfig = Record<string, Table<any, any>>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type GetTableRef<C> = C extends { references?: infer R } ? (NonNullable<R> extends { table: infer T } ? T : never) : never;
type GetBackRelName<C> = C extends { references?: infer R } ? (NonNullable<R> extends { backRelationName: infer B extends string } ? B : never) : never;
type GetRelName<C> = C extends { references?: infer R } ? (NonNullable<R> extends { relationName: infer N extends string } ? N : never) : never;

export type GetColumns<TTable> = TTable extends Table<any, infer C> ? C : never;

export type ExtractOneRelations<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = {
  [ColName in keyof GetColumns<TSchema[TTableName]> as GetTableRef<GetColumns<TSchema[TTableName]>[ColName]> extends keyof TSchema
  ? (GetRelName<GetColumns<TSchema[TTableName]>[ColName]> extends string ? GetRelName<GetColumns<TSchema[TTableName]>[ColName]> : GetTableRef<GetColumns<TSchema[TTableName]>[ColName]>)
  : never]: GetTableRef<GetColumns<TSchema[TTableName]>[ColName]> extends keyof TSchema
  ? { type: "one"; targetTable: GetTableRef<GetColumns<TSchema[TTableName]>[ColName]>; sourceColumn: ColName }
  : never;
};

export type ExtractManyRelations<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = UnionToIntersection<
  {
    [OtherTable in keyof TSchema]: {
      [ColName in keyof GetColumns<TSchema[OtherTable]> as GetTableRef<GetColumns<TSchema[OtherTable]>[ColName]> extends TTableName
      ? (GetBackRelName<GetColumns<TSchema[OtherTable]>[ColName]> extends string ? GetBackRelName<GetColumns<TSchema[OtherTable]>[ColName]> : OtherTable)
      : never]: { type: "many"; targetTable: OtherTable; targetColumn: ColName };
    };
  }[keyof TSchema]
>;

type GetOtherFK<TSchema extends SchemaConfig, TJunction extends keyof TSchema, TCol1 extends keyof GetColumns<TSchema[TJunction]>> = 
  {
    [K in keyof GetColumns<TSchema[TJunction]>]: K extends TCol1 ? never : 
      GetTableRef<GetColumns<TSchema[TJunction]>[K]> extends keyof TSchema ? GetTableRef<GetColumns<TSchema[TJunction]>[K]> : never;
  }[keyof GetColumns<TSchema[TJunction]>];

export type ExtractManyToManyRelations<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = UnionToIntersection<
  {
    [Junction in keyof TSchema]: {
      [ColName in keyof GetColumns<TSchema[Junction]> as GetTableRef<GetColumns<TSchema[Junction]>[ColName]> extends TTableName
      ? (GetBackRelName<GetColumns<TSchema[Junction]>[ColName]> extends string ? GetBackRelName<GetColumns<TSchema[Junction]>[ColName]> : (GetOtherFK<TSchema, Junction, ColName> extends string ? GetOtherFK<TSchema, Junction, ColName> : never))
      : never]: { type: "manyToMany"; targetTable: GetOtherFK<TSchema, Junction, ColName> }
    };
  }[keyof TSchema]
>;

export type ExtractTableRelations<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = ExtractOneRelations<
  TSchema,
  TTableName
> &
  ExtractManyRelations<TSchema, TTableName> &
  ExtractManyToManyRelations<TSchema, TTableName>;

export type TargetTable<TSchema extends SchemaConfig, TTableName extends keyof TSchema, K extends keyof ExtractTableRelations<TSchema, TTableName>> =
  ExtractTableRelations<TSchema, TTableName>[K] extends { targetTable: infer T }
  ? T extends keyof TSchema ? T : never
  : never;

export type WithConfig<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = {
  [K in keyof ExtractTableRelations<TSchema, TTableName>]?:
  | true
  | {
    columns?: Partial<Record<keyof GetColumns<TSchema[TargetTable<TSchema, TTableName, K>]>, boolean>>;
    with?: WithConfig<TSchema, TargetTable<TSchema, TTableName, K>>;
    limit?: number;
    offset?: number;
    orderBy?: OrderByObject<GetColumns<TSchema[TargetTable<TSchema, TTableName, K>]>> | SQLChunk;
    where?: WhereCondition<GetColumns<TSchema[TargetTable<TSchema, TTableName, K>]>>;
  };
};

export type FindManyArgs<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = {
  columns?: Partial<Record<keyof GetColumns<TSchema[TTableName]>, boolean>>;
  where?: WhereCondition<GetColumns<TSchema[TTableName]>>;
  limit?: number;
  offset?: number;
  orderBy?: OrderByObject<GetColumns<TSchema[TTableName]>> | SQLChunk;
  with?: WithConfig<TSchema, TTableName>;
};

// Flatten intersection types to make TS hover tooltips cleaner
type Prettify<T> = { [K in keyof T]: T[K] } & {};

type HasTrue<C> = true extends C[keyof C] ? true : false;

type ApplyColumns<TTableProps, TArgs> = TArgs extends { columns: infer C }
  ? (HasTrue<C> extends true
      ? { [K in keyof TTableProps as (K extends keyof C ? (C[K] extends true ? K : never) : never)]: TTableProps[K] }
      : { [K in keyof TTableProps as (K extends keyof C ? (C[K] extends false ? never : K) : K)]: TTableProps[K] })
  : TTableProps;

export type FindManyResult<
  TSchema extends SchemaConfig,
  TTableName extends keyof TSchema,
  TArgs extends any = undefined
> = Prettify<
  ApplyColumns<InferTable<GetColumns<TSchema[TTableName]>>, TArgs> &
  (TArgs extends { with: infer W }
    ? {
      [K in keyof W & keyof ExtractTableRelations<TSchema, TTableName>]: ExtractTableRelations<
        TSchema,
        TTableName
      >[K] extends { type: "one" }
      ? FindManyResult<TSchema, TargetTable<TSchema, TTableName, K>, W[K] extends FindManyArgs<any, any> ? W[K] : undefined> | null
      : FindManyResult<TSchema, TargetTable<TSchema, TTableName, K>, W[K] extends FindManyArgs<any, any> ? W[K] : undefined>[];
    }
    : {})
>;

export type MergeWith<TArgs, K extends string | number | symbol, TSubArgs> = TArgs extends { with: infer W }
  ? Omit<TArgs, "with"> & { with: W & { [P in K]: keyof TSubArgs extends never ? true : TSubArgs } }
  : TArgs & { with: { [P in K]: keyof TSubArgs extends never ? true : TSubArgs } };
