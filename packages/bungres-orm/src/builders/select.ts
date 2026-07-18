import type { OrderDir, QueryExecutor, WhereCondition } from "../core/query.js";
import type { SQLChunk } from "../core/sql.js";
import { sqlJoin, sql, rawSql } from "../core/sql.js";
import { parseWhereObject } from "../core/conditions.js";
import { type Table, getTableConfig } from "../schema/table.js";
import type { ColumnConfig, InferColumnType, InferTable } from "../types/index.js";

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
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _where: SQLChunk[] = [];
  private _orderBy: Array<{ column: string | ColumnConfig | SQLChunk<any>; dir: OrderDir }> = [];
  private _groupBy: Array<string | ColumnConfig | SQLChunk<any>> = [];
  private _having: SQLChunk[] = [];
  private _limit?: number;
  private _offset?: number;
  private _select?: ((keyof TColumns & string) | ColumnConfig)[];
  private _selection?: SelectedFields | undefined;
  private _joins: (string | SQLChunk)[] = [];
  private _comment?: string;

  constructor(table: Table<string, TColumns>, executor: QueryExecutor, selection?: SelectedFields) {
    this._table = table;
    this._executor = executor;
    this._selection = selection;
  }

  then<TResult1 = TResult[], TResult2 = never>(
    onfulfilled?: ((value: TResult[]) => TResult1 | PromiseLike<TResult1>) | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined
  ): Promise<TResult1 | TResult2> {
    return this._executor.execute<TResult>(this).then(onfulfilled, onrejected);
  }

  async single(): Promise<TResult | null> {
    return this._executor.executeSingle<TResult>(this);
  }

  select(...columns: ((keyof TColumns & string) | ColumnConfig)[]): this {
    this._select = columns;
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

  join(rawClause: string): this {
    this._joins.push(rawClause);
    return this;
  }

  innerJoin(table: Table<any, any>, condition: SQLChunk): this {
    this._joins.push(sql`INNER JOIN ${rawSql(getTableConfig(table).qualifiedName)} ON ${condition}`);
    return this;
  }

  leftJoin(table: Table<any, any>, condition: SQLChunk): this {
    this._joins.push(sql`LEFT JOIN ${rawSql(getTableConfig(table).qualifiedName)} ON ${condition}`);
    return this;
  }

  rightJoin(table: Table<any, any>, condition: SQLChunk): this {
    this._joins.push(sql`RIGHT JOIN ${rawSql(getTableConfig(table).qualifiedName)} ON ${condition}`);
    return this;
  }

  fullJoin(table: Table<any, any>, condition: SQLChunk): this {
    this._joins.push(sql`FULL JOIN ${rawSql(getTableConfig(table).qualifiedName)} ON ${condition}`);
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
      const qName = getTableConfig(this._table).qualifiedName;
      cols = this._select
        .map((c) => {
          if (typeof c === "string") {
            return `${qName}."${getTableConfig(this._table).columns[c]?.name ?? c}" AS "${c}"`;
          }
          return `${c.tableName ? c.tableName + '.' : ''}"${c.name}" AS "${(c as any).alias || c.name}"`;
        })
        .join(", ");
    } else {
      const qName = getTableConfig(this._table).qualifiedName;
      cols = Object.keys(getTableConfig(this._table).columns)
        .map((c) => `${qName}."${getTableConfig(this._table).columns[c]!.name}" AS "${c}"`)
        .join(", ");
    }

    let query = `SELECT ${cols} FROM ${getTableConfig(this._table).qualifiedName}`;

    if (this._joins.length > 0) {
      const joinChunks = this._joins.map((j) => (typeof j === "string" ? rawSql(j) : j));
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
            const dbCol = getTableConfig(this._table).columns[c]?.name ?? c;
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
            const dbCol = getTableConfig(this._table).columns[o.column]?.name ?? o.column;
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

    if (this._comment) {
      query += ` /* ${this._comment} */`;
    }

    return { sql: query, params };
  }
}

export class SelectBuilderIntermediate<TSelection extends SelectedFields | undefined = undefined> {
  constructor(private _executor: QueryExecutor, private _selection?: TSelection) { }

  from<TName extends string, TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(
    table: Table<TName, TColumns>
  ): SelectBuilder<
    TColumns,
    TSelection extends SelectedFields ? InferSelection<TSelection> : InferTable<TColumns>
  > {
    return new SelectBuilder(table, this._executor, this._selection);
  }
}
