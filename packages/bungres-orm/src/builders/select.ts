import type { OrderDir, QueryExecutor, WhereCondition } from "../core/query.js";
import type { SQLChunk } from "../core/sql.js";
import { sqlJoin } from "../core/sql.js";
import { type Table, getTableConfig } from "../schema/table.js";
import type { ColumnConfig, InferColumnType, InferTable } from "../types/index.js";

export type SelectedFields = Record<string, ColumnConfig<any, any, any, any>>;

export type InferSelection<T extends SelectedFields> = {
  [K in keyof T]: InferColumnType<T[K]>;
};

export class SelectBuilder<
  TColumns extends Record<string, ColumnConfig>,
  TResult = InferTable<TColumns>
> implements PromiseLike<TResult[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _where: WhereCondition[] = [];
  private _orderBy: Array<{ column: string; dir: OrderDir }> = [];
  private _limit?: number;
  private _offset?: number;
  private _select?: ((keyof TColumns & string) | ColumnConfig)[];
  private _selection?: SelectedFields | undefined;
  private _joins: string[] = [];
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

  where(condition: WhereCondition): this {
    this._where.push(condition);
    return this;
  }

  orderBy(column: (keyof TColumns & string) | (string & {}) | ColumnConfig, dir: OrderDir = "asc"): this {
    this._orderBy.push({ column: typeof column === "string" ? column : column.name, dir });
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

  toSQL(): SQLChunk {
    let cols = "";
    if (this._selection) {
      cols = Object.entries(this._selection)
        .map(([alias, col]) => `"${col.name}" AS "${alias}"`)
        .join(", ");
    } else if (this._select && this._select.length > 0) {
      cols = this._select
        .map((c) => {
          if (typeof c === "string") {
            return `"${getTableConfig(this._table).columns[c]?.name ?? c}" AS "${c}"`;
          }
          return `"${c.name}" AS "${(c as any).alias || c.name}"`;
        })
        .join(", ");
    } else {
      cols = Object.keys(getTableConfig(this._table).columns)
        .map((c) => `"${getTableConfig(this._table).columns[c]!.name}" AS "${c}"`)
        .join(", ");
    }

    let query = `SELECT ${cols} FROM ${getTableConfig(this._table).qualifiedName}`;

    if (this._joins.length > 0) {
      query += " " + this._joins.join(" ");
    }

    const params: unknown[] = [];

    if (this._where.length > 0) {
      const combined = sqlJoin(this._where, " AND ");
      const offset = 0;
      query +=
        " WHERE " +
        combined.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
      params.push(...combined.params);
    }

    if (this._orderBy.length > 0) {
      query +=
        " ORDER BY " +
        this._orderBy.map((o) => {
          const dbCol = getTableConfig(this._table).columns[o.column]?.name ?? o.column;
          return `"${dbCol}" ${o.dir.toUpperCase()}`;
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
