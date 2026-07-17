import type { QueryExecutor, WhereCondition } from "../core/query.js";
import type { SQLChunk } from "../core/sql.js";
import { sqlJoin } from "../core/sql.js";
import { parseWhereObject } from "../core/conditions.js";
import { type Table, getTableConfig } from "../schema/table.js";
import type { ColumnConfig, InferTable } from "../types/index.js";

export class DeleteBuilder<TColumns extends Record<string, ColumnConfig>> implements PromiseLike<InferTable<TColumns>[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _where: SQLChunk[] = [];
  private _returning?: string[];
  private _comment?: string;

  constructor(table: Table<string, TColumns>, executor: QueryExecutor) {
    this._table = table;
    this._executor = executor;
  }

  then<TResult1 = InferTable<TColumns>[], TResult2 = never>(
    onfulfilled?: ((value: InferTable<TColumns>[]) => TResult1 | PromiseLike<TResult1>) | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined
  ): Promise<TResult1 | TResult2> {
    return this._executor.execute<InferTable<TColumns>>(this).then(onfulfilled, onrejected);
  }

  async single(): Promise<InferTable<TColumns> | null> {
    return this._executor.executeSingle<InferTable<TColumns>>(this);
  }

  where(condition: WhereCondition<TColumns>): this {
    if (condition && typeof condition === "object" && !("sql" in condition)) {
      this._where.push(parseWhereObject(getTableConfig(this._table) as any, condition as any));
    } else {
      this._where.push(condition as SQLChunk);
    }
    return this;
  }

  returning(...columns: (keyof TColumns & string)[]): this {
    this._returning = columns.length > 0 ? columns : ["*"];
    return this;
  }

  comment(tag: string): this {
    this._comment = tag;
    return this;
  }

  toSQL(): SQLChunk {
    let query = `DELETE FROM ${getTableConfig(this._table).qualifiedName}`;
    const params: unknown[] = [];

    if (this._where.length > 0) {
      const combined = sqlJoin(this._where, " AND ");
      query += " WHERE " + combined.sql;
      params.push(...combined.params);
    }

    if (this._returning) {
      query +=
        " RETURNING " +
        (this._returning[0] === "*"
          ? Object.keys(getTableConfig(this._table).columns)
            .map((c) => `"${getTableConfig(this._table).columns[c]!.name}" AS "${c}"`)
            .join(", ")
          : this._returning
            .map((c) => `"${getTableConfig(this._table).columns[c]?.name ?? c}" AS "${c}"`)
            .join(", "));
    }

    return { sql: query, params };
  }
}
