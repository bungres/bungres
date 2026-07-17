import type { QueryExecutor, WhereCondition } from "../core/query.js";
import type { SQLChunk } from "../core/sql.js";
import { sqlJoin } from "../core/sql.js";
import { parseWhereObject } from "../core/conditions.js";
import { type Table, getTableConfig } from "../schema/table.js";
import type { ColumnConfig, InferTable } from "../types/index.js";

export class UpdateBuilder<TColumns extends Record<string, ColumnConfig>> implements PromiseLike<InferTable<TColumns>[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _set: Partial<InferTable<TColumns>> = {};
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

  set(data: Partial<{ [K in keyof InferTable<TColumns>]: InferTable<TColumns>[K] | SQLChunk }>): this {
    this._set = { ...this._set, ...data } as any;
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

    const params: unknown[] = [];
    const setClauses = entries.map(([key, value]) => {
      const dbCol = getTableConfig(this._table).columns[key]?.name ?? key;
      if (value && typeof value === "object" && "sql" in value && "params" in value) {
        const chunk = value as SQLChunk;
        const offset = params.length;
        params.push(...chunk.params);
        return `"${dbCol}" = ${chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)}`;
      }
      if (value && typeof value === "object" && !(value instanceof Date)) {
        const colType = getTableConfig(this._table).columns[key]?.dataType;
        if (colType === "json" || colType === "jsonb") {
          params.push(JSON.stringify(value));
        } else if (Array.isArray(value)) {
          const pgArray = '{' + value.map(item => {
            if (item === null || item === undefined) return 'NULL';
            if (typeof item === 'string') return '"' + item.replace(/"/g, '\\"') + '"';
            return typeof item === 'object' ? '"' + JSON.stringify(item).replace(/"/g, '\\"') + '"' : String(item);
          }).join(',') + '}';
          params.push(pgArray);
        } else {
          params.push(JSON.stringify(value));
        }
        return `"${dbCol}" = $${params.length}`;
      }
      params.push(value);
      return `"${dbCol}" = $${params.length}`;
    });

    let query = `UPDATE ${getTableConfig(this._table).qualifiedName} SET ${setClauses.join(", ")}`;

    if (this._where.length > 0) {
      const combined = sqlJoin(this._where, " AND ");
      const offset = params.length;
      query +=
        " WHERE " +
        combined.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
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
