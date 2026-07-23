import type { QueryExecutor, WhereCondition, OrderByObject } from "../core/query.js";
import type { SQLChunk } from "../core/sql.js";
import { parseWhereObject, parseOrderByObject } from "../core/conditions.js";
import { TableConfigSymbol } from "../schema/table.js";
import type { ExtractTableRelations, FindManyArgs, FindManyResult, MergeWith, SchemaConfig, TargetTable, GetColumns } from "../types/relations.js";
// ---------------------------------------------------------------------------

/** Find the primary key column's DB name from a table config */
function getPkColumn(tableConfig: any): string {
  // Check explicit primaryKeys first
  if (tableConfig.primaryKeys?.length > 0) return tableConfig.primaryKeys[0];
  // Then check column-level primaryKey flag
  for (const [, col] of Object.entries(tableConfig.columns as Record<string, any>)) {
    if (col.primaryKey) return col.name;
  }
  // Fallback to 'id'
  return "id";
}

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

  where(condition: WhereCondition<GetColumns<TSchema[TTableName]>>): RelationalQueryBuilder<TSchema, TTableName, TArgs & { where: typeof condition }> {
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

  orderBy(order: OrderByObject<GetColumns<TSchema[TTableName]>> | SQLChunk): RelationalQueryBuilder<TSchema, TTableName, TArgs & { orderBy: typeof order }> {
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
      if (!otherConfig) continue;
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
      if (!junctionConfig) continue;
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
    const hasTrue = columnsConfig ? Object.values(columnsConfig).some(v => v === true) : false;

    for (const [colKey, colConfig] of Object.entries(tableConfig.columns as Record<string, any>)) {
      if (columnsConfig) {
        if (hasTrue) {
          if (columnsConfig[colKey] !== true) continue;
        } else {
          if (columnsConfig[colKey] === false) continue;
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
        const targetConfig = (this._schema[rel.targetTable] as any)[TableConfigSymbol];
        const targetPk = getPkColumn(targetConfig);
        const joinCond = `"${subAlias}"."${targetPk}" = "${alias}"."${rel.sourceColumn}"`;

        const subQuery = this._buildSelectJson(rel.targetTable, rArgs, subAlias, params, alias, joinCond);
        const subSql = `SELECT ${subQuery.sql} ${subQuery.from}`;
        jsonFields.push(`'${relKey}', (${subSql})`);
      } else if (relations.manys[relKey]) {
        const rel = relations.manys[relKey];
        const subAlias = `${alias}_${relKey}`;
        // One-to-many
        const thisPk = getPkColumn(tableConfig);
        const joinCond = `"${subAlias}"."${rel.targetColumn}" = "${alias}"."${thisPk}"`;

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
          ON "${junctionAlias}"."${rel.joinTargetColumn}" = "${subAlias}"."${getPkColumn(targetTableConfig)}"
        `;
        const whereExtra = `"${junctionAlias}"."${rel.joinSourceColumn}" = "${alias}"."${getPkColumn(tableConfig)}"`;

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

    if (args.where) {
      const offset = params.length;
      let whereChunk: any = args.where;
      if (args.where && !args.where.sql) {
        whereChunk = parseWhereObject(tableConfig, args.where, alias);
      }
      
      if (whereChunk && whereChunk.sql) {
        fromSql += (joinCondition ? " AND " : " WHERE ") + whereChunk.sql.replace(/\$(\d+)/g, (_: string, n: string) => `$${parseInt(n) + offset}`);
        params.push(...whereChunk.params);
      }
    }

    if (args.orderBy) {
      if (typeof args.orderBy === "string") {
        fromSql += ` ORDER BY ${args.orderBy}`;
      } else if (args.orderBy.sql) {
        const offset = params.length;
        fromSql += ` ORDER BY ` + args.orderBy.sql.replace(/\$(\d+)/g, (_: string, n: string) => `$${parseInt(n) + offset}`);
        params.push(...args.orderBy.params);
      } else {
        const chunks = parseOrderByObject(tableConfig, args.orderBy, alias);
        if (chunks.length > 0) {
            fromSql += ` ORDER BY ` + chunks.map(c => {
                const offset = params.length;
                params.push(...c.params);
                return c.sql.replace(/\$(\d+)/g, (_: string, n: string) => `$${parseInt(n) + offset}`);
            }).join(", ");
        }
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
    const rootAlias = this._tableName as string;
    const subQuery = this._buildSelectJson(this._tableName as string, args, rootAlias, params);

    // Final wrapping to return rows as `_data`
    const sql = `SELECT ${subQuery.sql} AS _data ${subQuery.from}`;
    return { sql, params };
  }
}
