import type { QueryExecutor } from "../core/query.js";
import { type SQLChunk, toPgArray } from "../core/sql.js";
import { type Table, getTableConfig } from "../schema/table.js";
import type { ColumnConfig, InferInsert, InferTable } from "../types/index.js";
import type { CTEBuilder } from "./cte.js";

export class InsertBuilder<TColumns extends Record<string, ColumnConfig>> implements PromiseLike<InferTable<TColumns>[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _values: Partial<InferTable<TColumns>>[] = [];
  private _onConflict?: "do nothing" | SQLChunk;
  private _onConflictUpdateConfig?: {
    target: string | SQLChunk | (string | SQLChunk)[];
    set: Partial<{ [K in keyof InferTable<TColumns>]: InferTable<TColumns>[K] | SQLChunk }>;
  };
  private _returning?: string[];
  private _comment?: string;
  private _with: CTEBuilder[] = [];

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

  values(data: InferInsert<TColumns> | InferInsert<TColumns>[]): this {
    if (Array.isArray(data)) {
      this._values.push(...(data as any));
    } else {
      this._values.push(data as any);
    }
    return this;
  }

  onConflictDoNothing(): this {
    this._onConflict = "do nothing";
    return this;
  }

  onConflict(clause: SQLChunk): this {
    this._onConflict = clause;
    return this;
  }

  onConflictDoUpdate(config: { target: string | SQLChunk | (string | SQLChunk)[]; set: Partial<{ [K in keyof InferTable<TColumns>]: InferTable<TColumns>[K] | SQLChunk }> }): this {
    this._onConflictUpdateConfig = config;
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
    if (this._values.length === 0) {
      throw new Error("InsertBuilder: no values provided");
    }

    const tConfig = getTableConfig(this._table);

    // Get all unique keys across all objects to support partial inserts correctly
    const keySet = new Set<string>();
    for (const v of this._values) {
      for (const k of Object.keys(v)) {
        keySet.add(k);
      }
    }
    const keys = Array.from(keySet);

    if (keys.length === 0) {
      return { sql: `INSERT INTO ${tConfig.qualifiedName} DEFAULT VALUES`, params: [] };
    }

    const columnsStr = keys.map((k) => `"${tConfig.columns[k]?.name ?? k}"`).join(", ");

    const params: unknown[] = [];

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

    const valuesStrs = this._values.map((v) => {
      const vals = keys.map((k) => {
        const val = (v as any)[k];
        if (val && typeof val === "object" && "sql" in val && "params" in val) {
          const chunk = val as SQLChunk;
          const offset = params.length;
          params.push(...chunk.params);
          return chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
        }
        if (val && typeof val === "object" && !(val instanceof Date)) {
          const colType = tConfig.columns[k]?.dataType;
          if (colType === "json" || colType === "jsonb") {
            params.push(val);
          } else if (Array.isArray(val)) {
            params.push(toPgArray(val));
          } else {
            params.push(JSON.stringify(val));
          }
          return `$${params.length}`;
        }
        if (val === undefined) return "DEFAULT";
        params.push(val);
        return `$${params.length}`;
      });
      return `(${vals.join(", ")})`;
    });

    let query = `INSERT INTO ${tConfig.qualifiedName} (${columnsStr}) VALUES ${valuesStrs.join(", ")}`;

    if (this._onConflict) {
      if (this._onConflict === "do nothing") {
        query += " ON CONFLICT DO NOTHING";
      } else {
        const offset = params.length;
        query += " " + this._onConflict.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
        params.push(...this._onConflict.params);
      }
    } else if (this._onConflictUpdateConfig) {
      const config = this._onConflictUpdateConfig;
      const targets = Array.isArray(config.target) ? config.target : [config.target];
      const targetStrs: string[] = [];
      for (const t of targets) {
        if (typeof t === "string") {
          targetStrs.push(`"${tConfig.columns[t]?.name ?? t}"`);
        } else {
          const offset = params.length;
          targetStrs.push(t.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`));
          params.push(...t.params);
        }
      }

      const setEntries = Object.entries(config.set as Record<string, unknown>);
      if (setEntries.length === 0) throw new Error("InsertBuilder: onConflictDoUpdate requires 'set' fields");

      const setClauses = setEntries.map(([key, value]) => {
        const dbCol = tConfig.columns[key]?.name ?? key;
        if (value && typeof value === "object" && "sql" in value && "params" in value) {
          const chunk = value as SQLChunk;
          const offset = params.length;
          params.push(...chunk.params);
          return `"${dbCol}" = ${chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)}`;
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

      query += ` ON CONFLICT (${targetStrs.join(", ")}) DO UPDATE SET ${setClauses.join(", ")}`;
    }

    if (this._returning) {
      query +=
        " RETURNING " +
        (this._returning[0] === "*"
          ? Object.keys(tConfig.columns)
            .map((c) => `"${tConfig.columns[c]!.name}" AS "${c}"`)
            .join(", ")
          : this._returning
            .map((c) => `"${tConfig.columns[c]?.name ?? c}" AS "${c}"`)
            .join(", "));
    }

    if (this._comment) {
      query += ` /* ${this._comment.replace(/\*\//g, "")} */`;
    }

    return { sql: prefix + query, params };
  }
}
