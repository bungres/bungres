import { parseWhereObject } from "../core/conditions.js";
import type { QueryExecutor, WhereCondition, WhereObject } from "../core/query.js";
import type { SQLChunk } from "../core/sql.js";
import { sqlJoin, shiftParams } from "../core/sql.js";
import { type Table, getTableConfig } from "../schema/table.js";
import type { ColumnConfig, InferTable } from "../types/index.js";
import { applyComment, buildCtePrefix, buildReturningClause } from "../utils/sql-builder.js";
import type { CTEBuilder } from "./cte.js";
import { UpdateBuilder } from "./update.js";

export class DeleteBuilder<TColumns extends Record<string, ColumnConfig>> implements PromiseLike<InferTable<TColumns>[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _where: SQLChunk[] = [];
  private _returning?: string[];
  private _comment?: string;
  private _with: CTEBuilder[] = [];

  constructor(table: Table<string, TColumns>, executor: QueryExecutor) {
    this._table = table;
    this._executor = executor;
  }

  then<TResult1 = InferTable<TColumns>[], TResult2 = never>(
    onfulfilled?: ((value: InferTable<TColumns>[]) => TResult1 | PromiseLike<TResult1>) | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined
  ): Promise<TResult1 | TResult2> {
    return this._executor.execute<InferTable<TColumns>>(this).then(onfulfilled, onrejected);
  }

  async single(): Promise<InferTable<TColumns> | null> {
    return this._executor.executeSingle<InferTable<TColumns>>(this);
  }

  where(condition: WhereCondition<TColumns>): this {
    if (condition && typeof condition === "object" && !("sql" in condition)) {
      this._where.push(parseWhereObject(getTableConfig(this._table), condition as unknown as WhereObject<Record<string, ColumnConfig>>));
    } else {
      this._where.push(condition as SQLChunk);
    }
    return this;
  }

  async bulkDelete(conditions: WhereCondition<TColumns>[]): Promise<number> {
    let deletedCount = 0;
    for (const cond of conditions) {
      const builder = new DeleteBuilder(this._table, this._executor).where(cond);
      const res = await this._executor.execute(builder);
      deletedCount += res.length;
    }
    return deletedCount;
  }

  softDelete(deletedAtColumn = "deletedAt"): UpdateBuilder<TColumns> {
    const updateBuilder = new UpdateBuilder(this._table, this._executor);
    updateBuilder.set({ [deletedAtColumn]: new Date() } as any);
    for (const cond of this._where) {
      updateBuilder.where(cond);
    }
    return updateBuilder;
  }

  with(...ctes: CTEBuilder[]): this {
    this._with.push(...ctes);
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
    const tConfig = getTableConfig(this._table);
    const params: unknown[] = [];
    const prefix = buildCtePrefix(this._with, params);

    let query = `DELETE FROM ${tConfig.qualifiedName}`;

    if (this._where.length > 0) {
      const combined = sqlJoin(this._where, " AND ");
      const offset = params.length;
      query += " WHERE " + shiftParams(combined.sql, combined.params.length, offset);
      params.push(...combined.params);
    }

    query += buildReturningClause(this._returning, tConfig);
    query = applyComment(prefix + query, this._comment);

    return { sql: query, params };
  }
}
