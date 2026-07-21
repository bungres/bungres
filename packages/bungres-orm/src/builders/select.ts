import type { OrderDir, QueryExecutor, WhereCondition } from "../core/query.js";
import type { SQLChunk } from "../core/sql.js";
import { sqlJoin, sql, rawSql } from "../core/sql.js";
import { parseWhereObject } from "../core/conditions.js";
import { type Table, getTableConfig } from "../schema/table.js";
import type { ColumnConfig, InferColumnType, InferTable } from "../types/index.js";
import type { CTEBuilder } from "./cte.js";

export type SelectedFields = {
  [key: string]: ColumnConfig<any, any, any, any> | SQLChunk<any> | SelectedFields;
};

export type InferSelection<T extends SelectedFields> = {
  [K in keyof T]: T[K] extends ColumnConfig<any, any, any, any>
    ? InferColumnType<T[K]>
    : T[K] extends SQLChunk<infer U>
    ? U
    : T[K] extends SelectedFields
    ? InferSelection<T[K]>
    : never;
};

export class SelectBuilder<
  TColumns extends Record<string, ColumnConfig>,
  TResult = InferTable<TColumns>
> implements PromiseLike<TResult[]> {
  private _table: Table<string, TColumns> | CTEBuilder;
  private _executor: QueryExecutor;
  private _where: SQLChunk[] = [];
  private _orderBy: Array<{ column: string | ColumnConfig | SQLChunk<any>; dir: OrderDir }> = [];
  private _groupBy: Array<string | ColumnConfig | SQLChunk<any>> = [];
  private _having: SQLChunk[] = [];
  private _limit?: number;
  private _offset?: number;
  private _select?: ((keyof TColumns & string) | ColumnConfig)[];
  private _selection?: SelectedFields | undefined;
  private _joins: { table?: Table<any, any>; chunk: SQLChunk }[] = [];
  private _isNestedOutput = false;
  private _with: CTEBuilder[] = [];
  private _setOperations: { type: string, builder: { toSQL(): SQLChunk } }[] = [];
  private _comment?: string;

  constructor(table: Table<string, TColumns> | CTEBuilder, executor: QueryExecutor, selection?: SelectedFields) {
    this._table = table;
    this._executor = executor;
    this._selection = selection;
  }

  then<TResult1 = TResult[], TResult2 = never>(
    onfulfilled?: ((value: TResult[]) => TResult1 | PromiseLike<TResult1>) | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined
  ): Promise<TResult1 | TResult2> {
    return this._executor.execute<TResult>(this).then((rows: any) => {
      if (this._isNestedOutput) {
        rows = rows.map((r: any) => typeof r._nested_data === "string" ? JSON.parse(r._nested_data) : r._nested_data);
      }
      return onfulfilled ? onfulfilled(rows) : rows;
    }, onrejected);
  }

  async single(): Promise<TResult | null> {
    if (this._limit === undefined) {
      this.limit(1);
    }
    const rows = await this.then();
    return (rows as any)[0] ?? null;
  }

  select(...columns: ((keyof TColumns & string) | ColumnConfig)[]): this {
    this._select = columns;
    return this;
  }

  with(...ctes: CTEBuilder[]): this {
    this._with.push(...ctes);
    return this;
  }

  union(other: { toSQL(): SQLChunk }): this {
    this._setOperations.push({ type: "UNION", builder: other });
    return this;
  }

  unionAll(other: { toSQL(): SQLChunk }): this {
    this._setOperations.push({ type: "UNION ALL", builder: other });
    return this;
  }

  intersect(other: { toSQL(): SQLChunk }): this {
    this._setOperations.push({ type: "INTERSECT", builder: other });
    return this;
  }

  except(other: { toSQL(): SQLChunk }): this {
    this._setOperations.push({ type: "EXCEPT", builder: other });
    return this;
  }

  comment(tag: string): this {
    this._comment = tag;
    return this;
  }

  where(condition: WhereCondition<TColumns>): this {
    if (condition && typeof condition === "object" && !("sql" in condition)) {
      this._where.push(parseWhereObject(getTableConfig(this._table) as any, condition as any));
    } else {
      this._where.push(condition as SQLChunk);
    }
    return this;
  }

  orderBy(column: (keyof TColumns & string) | (string & {}) | ColumnConfig | SQLChunk<any>, dir: OrderDir = "asc"): this {
    this._orderBy.push({ column, dir });
    return this;
  }

  groupBy(...columns: ((keyof TColumns & string) | (string & {}) | ColumnConfig | SQLChunk<any>)[]): this {
    this._groupBy.push(...columns);
    return this;
  }

  having(condition: WhereCondition<TColumns>): this {
    if (condition && typeof condition === "object" && !("sql" in condition)) {
      this._having.push(parseWhereObject(getTableConfig(this._table) as any, condition as any));
    } else {
      this._having.push(condition as SQLChunk);
    }
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  offset(n: number): this {
    this._offset = n;
    return this;
  }

  as(aliasName: string): any {
    const columns: Record<string, any> = {};
    let fields: any[] = [];
    
    if (this._selection) {
      fields = Object.keys(this._selection);
    } else if (this._select && this._select.length > 0) {
      fields = this._select;
    } else if (!("alias" in this._table && "query" in this._table)) {
      fields = Object.keys(getTableConfig(this._table as any).columns);
    }
          
    for (const f of fields) {
      const key = typeof f === "string" ? f : (f as any).name || (f as any).alias;
      const dataType = typeof f !== "string" && (f as any).dataType ? (f as any).dataType : "any";
      if (key) columns[key] = { name: key, tableName: aliasName, dataType };
    }

    const sqObj: any = { ...columns };
    const TableConfigSymbol = Symbol.for("BungresTableConfig");
    sqObj[TableConfigSymbol] = {
      name: aliasName,
      qualifiedName: `"${aliasName}"`,
      columns,
      isSubquery: true,
      builder: this
    };

    return sqObj;
  }

  join(rawClause: string): this {
    this._joins.push({ chunk: rawSql(rawClause) });
    return this;
  }

  private _buildJoin(type: string, table: any, condition: SQLChunk): { table: any, chunk: SQLChunk } {
    const TableConfigSymbol = Symbol.for("BungresTableConfig");
    const cfg = table[TableConfigSymbol];
    if (cfg && cfg.isSubquery) {
      const sqChunk = cfg.builder.toSQL();
      return { 
        table, 
        chunk: sql`${rawSql(type)} JOIN (${sqChunk}) AS "${rawSql(cfg.name)}" ON ${condition}` 
      };
    }
    return { 
      table, 
      chunk: sql`${rawSql(type)} JOIN ${rawSql(cfg.qualifiedName)} ON ${condition}` 
    };
  }

  innerJoin(table: any, condition: SQLChunk): this {
    this._joins.push(this._buildJoin("INNER", table, condition));
    return this;
  }

  leftJoin(table: any, condition: SQLChunk): this {
    this._joins.push(this._buildJoin("LEFT", table, condition));
    return this;
  }

  rightJoin(table: any, condition: SQLChunk): this {
    this._joins.push(this._buildJoin("RIGHT", table, condition));
    return this;
  }

  fullJoin(table: any, condition: SQLChunk): this {
    this._joins.push(this._buildJoin("FULL", table, condition));
    return this;
  }

  private _buildSelection(selection: SelectedFields, params: unknown[]): string {
    const parts: string[] = [];
    for (const [alias, col] of Object.entries(selection)) {
      if (typeof col === "object" && col !== null) {
        if ("sql" in col && "params" in col) {
          const chunk = col as unknown as SQLChunk;
          const offset = params.length;
          params.push(...chunk.params);
          parts.push(`'${alias}', ${chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)}`);
        } else if ("name" in col && "dataType" in col) {
          const c = col as ColumnConfig<any, any, any, any>;
          parts.push(`'${alias}', ${c.tableName ? c.tableName + '.' : ''}"${c.name}"`);
        } else {
          parts.push(`'${alias}', json_build_object(${this._buildSelection(col as SelectedFields, params)})`);
        }
      }
    }
    return parts.join(", ");
  }

  toSQL(): SQLChunk {
    let cols = "";
    const params: unknown[] = [];

    const isCte = "alias" in this._table && "query" in this._table;
    const qName = isCte ? `"${(this._table as any).alias}"` : getTableConfig(this._table as any).qualifiedName;
    
    if (this._selection) {
      cols = Object.entries(this._selection)
        .map(([alias, col]) => {
          if (typeof col === "object" && col !== null && "sql" in col && "params" in col) {
            const chunk = col as unknown as SQLChunk;
            const offset = params.length;
            params.push(...chunk.params);
            return `${chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)} AS "${alias}"`;
          } else if (typeof col === "object" && col !== null && "name" in col && "dataType" in col) {
            const c = col as ColumnConfig<any, any, any, any>;
            return `${c.tableName ? c.tableName + '.' : ''}"${c.name}" AS "${alias}"`;
          } else {
            return `json_build_object(${this._buildSelection(col as SelectedFields, params)}) AS "${alias}"`;
          }
        })
        .join(", ");
    } else if (this._select && this._select.length > 0) {
      cols = this._select
        .map((c) => {
          if (typeof c === "string") {
            const colName = isCte ? c : (getTableConfig(this._table as any).columns[c]?.name ?? c);
            return `${qName}."${colName}" AS "${c}"`;
          }
          return `${c.tableName ? c.tableName + '.' : ''}"${c.name}" AS "${(c as any).alias || c.name}"`;
        })
        .join(", ");
    } else {
      if (isCte) {
        cols = "*";
      } else {
        const hasJoinedTables = this._joins.some(j => j.table);
        if (hasJoinedTables) {
          this._isNestedOutput = true;
          const rootCfg = getTableConfig(this._table as any);
          const tablesToSelect = [{ alias: rootCfg.name, config: rootCfg }];
          
          for (const join of this._joins) {
            if (join.table) {
              const cfg = getTableConfig(join.table as any);
              tablesToSelect.push({ alias: cfg.name, config: cfg });
            }
          }

          cols = `json_build_object(${tablesToSelect.map(t => {
            const innerFields = Object.keys(t.config.columns).map(c => {
               return `'${c}', "${t.config.name}"."${t.config.columns[c]!.name}"`;
            }).join(', ');
            return `'${t.alias}', json_build_object(${innerFields})`;
          }).join(', ')}) AS _nested_data`;
        } else {
          const colsKeys = Object.keys(getTableConfig(this._table as any).columns);
          if (colsKeys.length === 0) {
            cols = "*";
          } else {
            cols = colsKeys
              .map((c) => `${qName}."${getTableConfig(this._table as any).columns[c]!.name}" AS "${c}"`)
              .join(", ");
          }
        }
      }
    }

    let prefix = "";
    if (this._with.length > 0) {
      const cteStrs: string[] = [];
      for (const cte of this._with) {
        const chunk = cte.query.toSQL();
        const offset = params.length;
        params.push(...chunk.params);
        cteStrs.push(`"${cte.alias}" AS (${chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)})`);
      }
      prefix = `WITH ${cteStrs.join(", ")} `;
    }

    let query = `SELECT ${cols} FROM ${qName}`;

    if (this._joins.length > 0) {
      const joinChunks = this._joins.map((j) => j.chunk);
      const combinedJoins = sqlJoin(joinChunks, " ");
      const offset = params.length;
      query += " " + combinedJoins.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
      params.push(...combinedJoins.params);
    }

    if (this._where.length > 0) {
      const combined = sqlJoin(this._where, " AND ");
      const offset = params.length;
      query +=
        " WHERE " +
        combined.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
      params.push(...combined.params);
    }

    if (this._groupBy.length > 0) {
      const qName = getTableConfig(this._table).qualifiedName;
      query +=
        " GROUP BY " +
        this._groupBy.map((c) => {
          if (typeof c === "string") {
            const dbCol = isCte ? c : (getTableConfig(this._table as any).columns[c]?.name ?? c);
            return `${qName}."${dbCol}"`;
          } else if ("sql" in c && "params" in c) {
            const offset = params.length;
            params.push(...c.params);
            return c.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
          } else {
            return `${c.tableName ? c.tableName + '.' : ''}"${c.name}"`;
          }
        }).join(", ");
    }

    if (this._having.length > 0) {
      const combined = sqlJoin(this._having, " AND ");
      const offset = params.length;
      query +=
        " HAVING " +
        combined.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
      params.push(...combined.params);
    }

    if (this._orderBy.length > 0) {
      const qName = getTableConfig(this._table).qualifiedName;
      query +=
        " ORDER BY " +
        this._orderBy.map((o) => {
          if (typeof o.column === "string") {
            const dbCol = isCte ? o.column : (getTableConfig(this._table as any).columns[o.column]?.name ?? o.column);
            return `${qName}."${dbCol}" ${o.dir.toUpperCase()}`;
          } else if ("sql" in o.column && "params" in o.column) {
            const offset = params.length;
            params.push(...o.column.params);
            return `${o.column.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)} ${o.dir.toUpperCase()}`;
          } else {
            return `${o.column.tableName ? o.column.tableName + '.' : ''}"${o.column.name}" ${o.dir.toUpperCase()}`;
          }
        }).join(", ");
    }

    if (this._limit !== undefined) {
      params.push(this._limit);
      query += ` LIMIT $${params.length}`;
    }

    if (this._offset !== undefined) {
      params.push(this._offset);
      query += ` OFFSET $${params.length}`;
    }

    if (this._setOperations.length > 0) {
      for (const op of this._setOperations) {
        const chunk = op.builder.toSQL();
        const offset = params.length;
        params.push(...chunk.params);
        query += ` ${op.type} ${chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)}`;
      }
    }

    if (this._comment) {
      query += ` /* ${this._comment.replace(/\*\//g, "")} */`;
    }

    return { sql: prefix + query, params };
  }
}

export class SelectBuilderIntermediate<TSelection extends SelectedFields | undefined = undefined> {
  constructor(private _executor: QueryExecutor, private _selection?: TSelection) { }

  from<TName extends string, TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(
    table: Table<TName, TColumns> | CTEBuilder
  ): SelectBuilder<
    TColumns,
    TSelection extends SelectedFields ? InferSelection<TSelection> : InferTable<TColumns>
  > {
    return new SelectBuilder(table as any, this._executor, this._selection);
  }
}
