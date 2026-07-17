import type { QueryExecutor } from "./query.js";
import type { SQLChunk } from "./sql.js";
import type { Table } from "./table.js";
import { TableConfigSymbol } from "./table.js";
import type { InferTable } from "./types.js";

// ---------------------------------------------------------------------------
// Type-level schema extraction (Zero-Boilerplate Relations)
// ---------------------------------------------------------------------------

export type SchemaConfig = Record<string, Table<any, any>>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type GetTableRef<C> = C extends { references?: infer R } ? (NonNullable<R> extends { table: infer T } ? T : never) : never;
type GetBackRelName<C> = C extends { references?: infer R } ? (NonNullable<R> extends { backRelationName: infer B extends string } ? B : never) : never;
type GetRelName<C> = C extends { references?: infer R } ? (NonNullable<R> extends { relationName: infer N extends string } ? N : never) : never;

export type ExtractOneRelations<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = {
  [ColName in keyof TSchema[TTableName]as GetTableRef<TSchema[TTableName][ColName]> extends keyof TSchema
  ? (GetRelName<TSchema[TTableName][ColName]> extends string ? GetRelName<TSchema[TTableName][ColName]> : GetTableRef<TSchema[TTableName][ColName]>)
  : never]: GetTableRef<TSchema[TTableName][ColName]> extends keyof TSchema
  ? { type: "one"; targetTable: GetTableRef<TSchema[TTableName][ColName]>; sourceColumn: ColName }
  : never;
};

export type ExtractManyRelations<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = UnionToIntersection<
  {
    [OtherTable in keyof TSchema]: {
      [ColName in keyof TSchema[OtherTable]as GetTableRef<TSchema[OtherTable][ColName]> extends TTableName
      ? (GetBackRelName<TSchema[OtherTable][ColName]> extends string ? GetBackRelName<TSchema[OtherTable][ColName]> : OtherTable)
      : never]: { type: "many"; targetTable: OtherTable; targetColumn: ColName };
    };
  }[keyof TSchema]
>;

type GetOtherFK<TSchema extends SchemaConfig, TJunction extends keyof TSchema, TCol1 extends keyof TSchema[TJunction]> = 
  {
    [K in keyof TSchema[TJunction]]: K extends TCol1 ? never : 
      GetTableRef<TSchema[TJunction][K]> extends keyof TSchema ? GetTableRef<TSchema[TJunction][K]> : never;
  }[keyof TSchema[TJunction]];

export type ExtractManyToManyRelations<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = UnionToIntersection<
  {
    [Junction in keyof TSchema]: {
      [ColName in keyof TSchema[Junction] as GetTableRef<TSchema[Junction][ColName]> extends TTableName
      ? (GetBackRelName<TSchema[Junction][ColName]> extends string ? GetBackRelName<TSchema[Junction][ColName]> : (GetOtherFK<TSchema, Junction, ColName> extends string ? GetOtherFK<TSchema, Junction, ColName> : never))
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

type TargetTable<TSchema extends SchemaConfig, TTableName extends keyof TSchema, K extends keyof ExtractTableRelations<TSchema, TTableName>> =
  ExtractTableRelations<TSchema, TTableName>[K] extends { targetTable: infer T }
  ? T extends keyof TSchema ? T : never
  : never;

export type WithConfig<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = {
  [K in keyof ExtractTableRelations<TSchema, TTableName>]?:
  | true
  | {
    columns?: { [Col in keyof TSchema[TargetTable<TSchema, TTableName, K>]]?: boolean };
    with?: WithConfig<TSchema, TargetTable<TSchema, TTableName, K>>;
    limit?: number;
    offset?: number;
    orderBy?: any;
    where?: SQLChunk;
  };
};

export type FindManyArgs<TSchema extends SchemaConfig, TTableName extends keyof TSchema> = {
  columns?: { [Col in keyof TSchema[TTableName]]?: boolean };
  where?: SQLChunk;
  limit?: number;
  offset?: number;
  orderBy?: any;
  with?: WithConfig<TSchema, TTableName>;
};

// Flatten intersection types to make TS hover tooltips cleaner
type Prettify<T> = { [K in keyof T]: T[K] } & {};

type ApplyColumns<TTableProps, TArgs> = TArgs extends { columns: infer C }
  ? { [K in keyof TTableProps as (K extends keyof C ? (C[K] extends true ? K : never) : never)]: TTableProps[K] }
  : TTableProps;

export type FindManyResult<
  TSchema extends SchemaConfig,
  TTableName extends keyof TSchema,
  TArgs extends FindManyArgs<TSchema, TTableName> | undefined
> = Prettify<
  ApplyColumns<InferTable<TSchema[TTableName]>, TArgs> &
  (TArgs extends { with: infer W }
    ? {
      [K in keyof W & keyof ExtractTableRelations<TSchema, TTableName>]: ExtractTableRelations<
        TSchema,
        TTableName
      >[K] extends { type: "one" }
      ? FindManyResult<TSchema, TargetTable<TSchema, TTableName, K>, any> | null
      : FindManyResult<TSchema, TargetTable<TSchema, TTableName, K>, any>[];
    }
    : {})
>;

export type MergeWith<TArgs, K extends string | number | symbol, TSubArgs> = TArgs extends { with: infer W }
  ? Omit<TArgs, "with"> & { with: W & { [P in K]: keyof TSubArgs extends never ? true : TSubArgs } }
  : TArgs & { with: { [P in K]: keyof TSubArgs extends never ? true : TSubArgs } };

// ---------------------------------------------------------------------------
// Runtime Execution (Lateral Joins & JSON Aggregation)
// ---------------------------------------------------------------------------

const _relationsCache = new WeakMap<any, Map<string, { 
  ones: Record<string, any>; 
  manys: Record<string, any>;
  manyToManys: Record<string, any>;
}>>();

export class RelationalQueryBuilder<
  TSchema extends SchemaConfig,
  TTableName extends keyof TSchema,
  TArgs extends FindManyArgs<TSchema, TTableName> = {}
> {
  // Expose _args publicly for the builder to read when chaining
  public _args: TArgs;

  constructor(
    private _executor: QueryExecutor,
    private _schema: TSchema,
    private _tableName: TTableName,
    args?: TArgs
  ) {
    this._args = args ?? ({} as TArgs);
  }

  where(condition: SQLChunk): RelationalQueryBuilder<TSchema, TTableName, TArgs & { where: SQLChunk }> {
    return new RelationalQueryBuilder(this._executor, this._schema, this._tableName, {
      ...this._args,
      where: condition
    });
  }

  limit(n: number): RelationalQueryBuilder<TSchema, TTableName, TArgs & { limit: number }> {
    return new RelationalQueryBuilder(this._executor, this._schema, this._tableName, {
      ...this._args,
      limit: n
    });
  }

  offset(n: number): RelationalQueryBuilder<TSchema, TTableName, TArgs & { offset: number }> {
    return new RelationalQueryBuilder(this._executor, this._schema, this._tableName, {
      ...this._args,
      offset: n
    });
  }

  orderBy(order: any): RelationalQueryBuilder<TSchema, TTableName, TArgs & { orderBy: any }> {
    return new RelationalQueryBuilder(this._executor, this._schema, this._tableName, {
      ...this._args,
      orderBy: order
    });
  }

  select<K extends (TTableName extends any ? keyof TSchema[TTableName]["$inferSelect"] : never)>(...fields: K[]): RelationalQueryBuilder<TSchema, TTableName, TArgs & { columns: { [P in K]: true } }> {
    const columnsConfig = Object.fromEntries(fields.map(f => [f, true])) as any;
    return new RelationalQueryBuilder(this._executor, this._schema, this._tableName, {
      ...this._args,
      columns: {
        ...(this._args.columns || {}),
        ...columnsConfig
      }
    });
  }

  with<
    K extends keyof ExtractTableRelations<TSchema, TTableName>,
    TSubArgs extends FindManyArgs<any, any> = any
  >(
    relation: K,
    callback: (qb: RelationalQueryBuilder<TSchema, TargetTable<TSchema, TTableName, K>, {}>) => RelationalQueryBuilder<any, any, TSubArgs>
  ): RelationalQueryBuilder<TSchema, TTableName, MergeWith<TArgs, K, TSubArgs>>;

  with(relation: any, callback?: any): any {
    const relations = this._getRuntimeRelations(this._tableName as string);
    const rel = relations.ones[relation as string] || relations.manys[relation as string] || relations.manyToManys[relation as string];
    if (!rel) throw new Error(`Relation ${String(relation)} not found on table ${String(this._tableName)}`);

    const subQb = new RelationalQueryBuilder(this._executor, this._schema, rel.targetTable as any);
    const configuredSubQb = callback ? callback(subQb) : subQb;

    const newArgs: any = { ...this._args };
    newArgs.with = { ...(newArgs.with || {}), [relation]: callback ? configuredSubQb._args : true };

    return new RelationalQueryBuilder(this._executor, this._schema, this._tableName, newArgs) as any;
  }

  async findMany<TFallbackArgs extends FindManyArgs<TSchema, TTableName> = TArgs>(
    args?: TFallbackArgs
  ): Promise<FindManyResult<TSchema, TTableName, TFallbackArgs>[]> {
    const finalArgs = { ...this._args, ...(args ?? {}) } as any;
    const chunk = this.buildSQL(finalArgs);
    const rows = await this._executor.execute<{ _data: string }>(chunk);
    // The DB returns a JSON string or object depending on driver, parse if string
    return rows.map((r: any) => (typeof r._data === "string" ? JSON.parse(r._data) : r._data)) as any;
  }

  async findFirst<TFallbackArgs extends FindManyArgs<TSchema, TTableName> = TArgs>(
    args?: TFallbackArgs
  ): Promise<FindManyResult<TSchema, TTableName, TFallbackArgs> | null> {
    const finalArgs = { ...this._args, ...(args ?? {}), limit: 1 } as any;
    const res = await this.findMany(finalArgs);
    return (res[0] as any) ?? null;
  }



  // Parses the schema config to find relations dynamically at runtime
  private _getRuntimeRelations(tableName: string) {
    let schemaCache = _relationsCache.get(this._schema);
    if (!schemaCache) {
      schemaCache = new Map();
      _relationsCache.set(this._schema, schemaCache);
    }
    
    let cached = schemaCache.get(tableName);
    if (cached) return cached;
    const table = this._schema[tableName];
    const tConfig = (table as any)[TableConfigSymbol];
    const ones: Record<string, { targetTable: string; sourceColumn: string }> = {};
    const manys: Record<string, { targetTable: string; targetColumn: string }> = {};
    const manyToManys: Record<string, { junctionTable: string; targetTable: string; joinSourceColumn: string; joinTargetColumn: string }> = {};

    // 1. Find "One" relations on this table
    for (const [colName, col] of Object.entries(tConfig.columns as Record<string, any>)) {
      if (col.references) {
        const ref = col.references;
        const relName = ref.relationName || ref.table;
        ones[relName] = { targetTable: ref.table, sourceColumn: col.name };
      }
    }

    // 2. Find "Many" relations from other tables pointing to this table
    for (const [otherName, otherTable] of Object.entries(this._schema)) {
      const otherConfig = (otherTable as any)[TableConfigSymbol];
      for (const [colName, col] of Object.entries(otherConfig.columns as Record<string, any>)) {
        if (col.references && col.references.table === tableName) {
          const ref = col.references;
          const backRelName = ref.backRelationName || otherName;
          manys[backRelName] = { targetTable: otherName, targetColumn: col.name };
        }
      }
    }

    // 3. Find "ManyToMany" relations through junction tables
    for (const [junctionName, junctionTable] of Object.entries(this._schema)) {
      const junctionConfig = (junctionTable as any)[TableConfigSymbol];
      const refs = Object.entries(junctionConfig.columns).filter(([_, c]) => (c as any).references);
      
      const toThis = refs.find(([_, c]) => (c as any).references.table === tableName);
      if (toThis) {
        for (const [otherColName, otherCol] of refs) {
          if (otherCol === toThis[1]) continue;
          
          const ref = (otherCol as any).references;
          const targetTableName = ref.table;
          const relName = (toThis[1] as any).references.backRelationName || targetTableName;
          
          manyToManys[relName] = {
            junctionTable: junctionName,
            targetTable: targetTableName,
            joinSourceColumn: (toThis[1] as any).name,
            joinTargetColumn: (otherCol as any).name,
          };
        }
      }
    }

    const result = { ones, manys, manyToManys };
    schemaCache.set(tableName, result);
    return result;
  }

  // Recursively builds a JSON select using LATERAL joins
  private _buildSelectJson(
    tableName: string,
    args: any,
    alias: string,
    params: unknown[],
    parentAlias?: string,
    joinCondition?: string,
    extraJoin?: string
  ): { sql: string; from: string } {
    const tableConfig = (this._schema[tableName] as any)[TableConfigSymbol];
    const relations = this._getRuntimeRelations(tableName);
    const withArgs = args.with || {};

    const jsonFields: string[] = [];
    const lateralJoins: string[] = [];

    // Base table columns
    const columnsConfig = args.columns;
    for (const [colKey, colConfig] of Object.entries(tableConfig.columns as Record<string, any>)) {
      if (columnsConfig) {
        if (columnsConfig[colKey] !== true) {
          continue; // Skip if not explicitly requested in columns
        }
      }
      jsonFields.push(`'${colKey}', "${alias}"."${colConfig.name}"`);
    }

    // Process 'with' relations
    for (const [relKey, relArgs] of Object.entries(withArgs)) {
      const isTrue = relArgs === true;
      const rArgs = isTrue ? {} : (relArgs as any);

      if (relations.ones[relKey]) {
        const rel = relations.ones[relKey];
        const subAlias = `${alias}_${relKey}`;
        // One-to-one or Many-to-one
        const joinCond = `"${subAlias}"."${(this._schema[rel.targetTable] as any)[TableConfigSymbol].columns.id?.name ?? "id"
          }" = "${alias}"."${rel.sourceColumn}"`;

        const subQuery = this._buildSelectJson(rel.targetTable, rArgs, subAlias, params, alias, joinCond);
        const subSql = `SELECT ${subQuery.sql} ${subQuery.from}`;
        jsonFields.push(`'${relKey}', (${subSql})`);
      } else if (relations.manys[relKey]) {
        const rel = relations.manys[relKey];
        const subAlias = `${alias}_${relKey}`;
        // One-to-many
        const joinCond = `"${subAlias}"."${rel.targetColumn}" = "${alias}"."${tableConfig.columns.id?.name ?? "id"
          }"`;

        const subQuery = this._buildSelectJson(rel.targetTable, rArgs, subAlias, params, alias, joinCond);

        // Aggregate rows into JSON array
        const aggAlias = `${subAlias}_agg`;
        const aggSql = `
          SELECT COALESCE(json_agg(_sub.obj), '[]'::json)
          FROM (
            SELECT ${subQuery.sql} AS obj
            ${subQuery.from}
          ) _sub
        `;

        jsonFields.push(`'${relKey}', (${aggSql})`);
      } else if (relations.manyToManys[relKey]) {
        const rel = relations.manyToManys[relKey];
        const subAlias = `${alias}_${relKey}`;
        const junctionAlias = `${alias}_j_${relKey}`;
        
        const targetTableConfig = (this._schema[rel.targetTable] as any)[TableConfigSymbol];
        const junctionTableConfig = (this._schema[rel.junctionTable] as any)[TableConfigSymbol];
        
        const fromExtra = `
          INNER JOIN ${junctionTableConfig.qualifiedName} AS "${junctionAlias}"
          ON "${junctionAlias}"."${rel.joinTargetColumn}" = "${subAlias}"."${targetTableConfig.columns.id?.name ?? "id"}"
        `;
        const whereExtra = `"${junctionAlias}"."${rel.joinSourceColumn}" = "${alias}"."${tableConfig.columns.id?.name ?? "id"}"`;
        
        const subQuery = this._buildSelectJson(rel.targetTable, rArgs, subAlias, params, alias, whereExtra, fromExtra);

        // Aggregate rows into JSON array
        const aggSql = `
          SELECT COALESCE(json_agg(_sub.obj), '[]'::json)
          FROM (
            SELECT ${subQuery.sql} AS obj
            ${subQuery.from}
          ) _sub
        `;

        jsonFields.push(`'${relKey}', (${aggSql})`);
      }
    }

    // Construct the JSON object select
    let selectSql = `json_build_object(${jsonFields.join(", ")})`;

    // For root or nested many, we need to construct the full query block.
    // However, if it's a subquery for a ONE relation or the main array, it's simpler.

    let fromSql = `FROM ${tableConfig.qualifiedName} AS "${alias}"`;

    if (extraJoin) {
      fromSql += ` ${extraJoin}`;
    }

    if (joinCondition) {
      fromSql += ` WHERE ${joinCondition}`;
    }

    if (args.where && args.where.sql) {
      const offset = params.length;
      fromSql += (joinCondition ? " AND " : " WHERE ") + args.where.sql.replace(/\$(\d+)/g, (_: string, n: string) => `$${parseInt(n) + offset}`);
      params.push(...args.where.params);
    }

    if (args.orderBy) {
      if (typeof args.orderBy === "string") {
        fromSql += ` ORDER BY ${args.orderBy}`;
      } else if (args.orderBy.sql) {
        const offset = params.length;
        fromSql += ` ORDER BY ` + args.orderBy.sql.replace(/\$(\d+)/g, (_: string, n: string) => `$${parseInt(n) + offset}`);
        params.push(...args.orderBy.params);
      }
    }

    if (args.limit !== undefined) {
      params.push(args.limit);
      fromSql += ` LIMIT $${params.length}`;
    }

    if (args.offset !== undefined) {
      params.push(args.offset);
      fromSql += ` OFFSET $${params.length}`;
    }

    return { sql: selectSql, from: fromSql };
  }

  buildSQL(args: FindManyArgs<TSchema, TTableName>): SQLChunk {
    const params: unknown[] = [];
    const rootAlias = "root";
    const subQuery = this._buildSelectJson(this._tableName as string, args, rootAlias, params);

    // Final wrapping to return rows as `_data`
    const sql = `SELECT ${subQuery.sql} AS _data ${subQuery.from}`;
    return { sql, params };
  }
}
