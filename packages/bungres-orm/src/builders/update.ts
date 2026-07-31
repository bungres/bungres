import type { QueryExecutor, WhereCondition, WhereObject } from "../core/query.js";
import { type SQLChunk, sqlJoin, toPgArray, shiftParams } from "../core/sql.js";
import { parseWhereObject } from "../core/conditions.js";
import { type Table, getTableConfig } from "../schema/table.js";
import type { ColumnConfig, InferTable } from "../types/index.js";
import { applyComment, buildCtePrefix, buildReturningClause } from "../utils/sql-builder.js";
import type { CTEBuilder } from "./cte.js";

export class UpdateBuilder<TColumns extends Record<string, ColumnConfig>> implements PromiseLike<InferTable<TColumns>[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _set: Partial<InferTable<TColumns>> = {};
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

  set(data: Partial<{ [K in keyof InferTable<TColumns>]: InferTable<TColumns>[K] | SQLChunk }>): this {
    this._set = { ...this._set, ...data } as Partial<InferTable<TColumns>>;
    return this;
  }

  async bulkUpdate(
    updates: Array<{
      where: WhereCondition<TColumns>;
      set: Partial<{ [K in keyof InferTable<TColumns>]: InferTable<TColumns>[K] | SQLChunk }>;
    }>
  ): Promise<void> {
    for (const updateItem of updates) {
      const builder = new UpdateBuilder(this._table, this._executor)
        .set(updateItem.set)
        .where(updateItem.where);
      await this._executor.execute(builder);
    }
  }

  where(condition: WhereCondition<TColumns>): this {
    if (condition && typeof condition === "object" && !("sql" in condition)) {
      this._where.push(parseWhereObject(getTableConfig(this._table), condition as unknown as WhereObject<Record<string, ColumnConfig>>));
    } else {
      this._where.push(condition as SQLChunk);
    }
    return this;
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
    const entries = Object.entries(this._set as Record<string, unknown>);
    if (entries.length === 0) {
      throw new Error("UpdateBuilder: no fields to set");
    }

    const tConfig = getTableConfig(this._table);
    const params: unknown[] = [];
    const prefix = buildCtePrefix(this._with, params);

    const setClauses = entries.map(([key, value]) => {
      const dbCol = tConfig.columns[key]?.name ?? key;
      if (value && typeof value === "object" && "sql" in value && "params" in value) {
        const chunk = value as SQLChunk;
        const offset = params.length;
        params.push(...chunk.params);
        return `"${dbCol}" = ${shiftParams(chunk.sql, chunk.params.length, offset)}`;
      }
      if (value && typeof value === "object" && !(value instanceof Date)) {
        const colType = tConfig.columns[key]?.dataType;
        if (colType === "json" || colType === "jsonb") {
          params.push(value);
        } else if (Array.isArray(value)) {
          params.push(toPgArray(value));
        } else {
          params.push(JSON.stringify(value));
        }
        return `"${dbCol}" = $${params.length}`;
      }
      params.push(value);
      return `"${dbCol}" = $${params.length}`;
    });

    let query = `UPDATE ${tConfig.qualifiedName} SET ${setClauses.join(", ")}`;

    if (this._where.length > 0) {
      const combined = sqlJoin(this._where, " AND ");
      const offset = params.length;
      query +=
        " WHERE " +
        shiftParams(combined.sql, combined.params.length, offset);
      params.push(...combined.params);
    }

    query += buildReturningClause(this._returning, tConfig);
    query = applyComment(prefix + query, this._comment);

    return { sql: query, params };
  }
}
