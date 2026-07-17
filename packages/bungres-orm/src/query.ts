import type { ColumnConfig, InferTable, InferInsert, InferColumnType } from "./types.js";
import { type Table, TableConfigSymbol, getTableConfig } from "./table.js";
import type { SQLChunk } from "./sql.js";
import { sql, sqlJoin, rawSql } from "./sql.js";

export type SelectedFields = Record<string, ColumnConfig<any, any, any, any>>;

export type InferSelection<T extends SelectedFields> = {
  [K in keyof T]: InferColumnType<T[K]>;
};

// ---------------------------------------------------------------------------
// QueryBuilder — fluent SELECT / INSERT / UPDATE / DELETE builder
// ---------------------------------------------------------------------------

type WhereCondition = SQLChunk;
type OrderDir = "asc" | "desc";

// Helper: extract the actual DB column names (the `name` field) from a columns record
type DBColumnNames<TColumns extends Record<string, ColumnConfig>> =
  TColumns[keyof TColumns]["name"];

export interface QueryExecutor {
  execute<T>(builder: { toSQL(): SQLChunk } | SQLChunk): Promise<T[]>;
  executeSingle<T>(builder: { toSQL(): SQLChunk } | SQLChunk): Promise<T | null>;
}

// ── SELECT ──────────────────────────────────────────────────────────────────

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

  /** Order by a column. Accepts both TS key names and DB column names, or ColumnConfig. */
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

  /** Raw JOIN clause — e.g. 'JOIN "orders" ON "orders"."user_id" = "users"."id"' */
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
  constructor(private _executor: QueryExecutor, private _selection?: TSelection) {}
  
  from<TName extends string, TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(
    table: Table<TName, TColumns>
  ): SelectBuilder<
    TColumns,
    TSelection extends SelectedFields ? InferSelection<TSelection> : InferTable<TColumns>
  > {
    return new SelectBuilder(table, this._executor, this._selection);
  }
}

// ── INSERT ───────────────────────────────────────────────────────────────────

export class InsertBuilder<TColumns extends Record<string, ColumnConfig>> implements PromiseLike<InferTable<TColumns>[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _values: Partial<InferTable<TColumns>>[] = [];
  private _onConflict?: "do nothing" | SQLChunk;
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

  values(
    data:
      | Partial<InferInsert<TColumns>>
      | Partial<InferInsert<TColumns>>[]
  ): this {
    const rows = Array.isArray(data) ? data : [data];
    this._values.push(...(rows as Partial<InferTable<TColumns>>[]));
    return this;
  }

  onConflictDoNothing(): this {
    this._onConflict = "do nothing";
    return this;
  }

  onConflictDoUpdate(clause: SQLChunk): this {
    this._onConflict = clause;
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

    // Collect all keys across all rows
    const keys = Array.from(
      new Set(this._values.flatMap((v) => Object.keys(v as object)))
    );

    const params: unknown[] = [];
    const rowPlaceholders: string[] = [];

    for (const row of this._values) {
      const placeholders: string[] = [];
      for (const key of keys) {
        params.push((row as Record<string, unknown>)[key] ?? null);
        placeholders.push(`$${params.length}`);
      }
      rowPlaceholders.push(`(${placeholders.join(", ")})`);
    }

    const colList = keys
      .map((k) => `"${getTableConfig(this._table).columns[k]?.name ?? k}"`)
      .join(", ");
    let query = `INSERT INTO ${getTableConfig(this._table).qualifiedName} (${colList}) VALUES ${rowPlaceholders.join(", ")}`;

    if (this._onConflict === "do nothing") {
      query += " ON CONFLICT DO NOTHING";
    } else if (this._onConflict && typeof this._onConflict === "object") {
      const offset = params.length;
      query +=
        " ON CONFLICT " +
        this._onConflict.sql.replace(
          /\$(\d+)/g,
          (_, n) => `$${parseInt(n) + offset}`
        );
      params.push(...this._onConflict.params);
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

// ── UPDATE ───────────────────────────────────────────────────────────────────

export class UpdateBuilder<TColumns extends Record<string, ColumnConfig>> implements PromiseLike<InferTable<TColumns>[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _set: Partial<InferTable<TColumns>> = {};
  private _where: WhereCondition[] = [];
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

  set(data: Partial<InferTable<TColumns>>): this {
    this._set = { ...this._set, ...data };
    return this;
  }

  where(condition: WhereCondition): this {
    this._where.push(condition);
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
      params.push(value);
      const dbCol = getTableConfig(this._table).columns[key]?.name ?? key;
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

// ── DELETE ───────────────────────────────────────────────────────────────────

export class DeleteBuilder<TColumns extends Record<string, ColumnConfig>> implements PromiseLike<InferTable<TColumns>[]> {
  private _table: Table<string, TColumns>;
  private _executor: QueryExecutor;
  private _where: WhereCondition[] = [];
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

  where(condition: WhereCondition): this {
    this._where.push(condition);
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

// ---------------------------------------------------------------------------
// Condition helpers — eq, ne, gt, lt, gte, lte, like, ilike, isNull, inArray
// ---------------------------------------------------------------------------

const colName = (c: string | ColumnConfig) => typeof c === "string" ? c : c.name;

export const eq = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" = ${value}`;

export const ne = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" != ${value}`;

export const gt = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" > ${value}`;

export const gte = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" >= ${value}`;

export const lt = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" < ${value}`;

export const lte = (column: string | ColumnConfig, value: unknown): SQLChunk =>
  sql`"${rawSql(colName(column))}" <= ${value}`;

export const like = (column: string | ColumnConfig, pattern: string): SQLChunk =>
  sql`"${rawSql(colName(column))}" LIKE ${pattern}`;

export const ilike = (column: string | ColumnConfig, pattern: string): SQLChunk =>
  sql`"${rawSql(colName(column))}" ILIKE ${pattern}`;

export const isNull = (column: string | ColumnConfig): SQLChunk =>
  rawSql(`"${colName(column)}" IS NULL`);

export const isNotNull = (column: string | ColumnConfig): SQLChunk =>
  rawSql(`"${colName(column)}" IS NOT NULL`);

export const inArray = (column: string | ColumnConfig, values: unknown[]): SQLChunk => {
  if (values.length === 0) return rawSql("FALSE");
  const params = values;
  const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
  return { sql: `"${colName(column)}" = ANY(ARRAY[${placeholders}])`, params };
};

export const and = (...conditions: SQLChunk[]): SQLChunk =>
  sqlJoin(conditions, " AND ");

export const or = (...conditions: SQLChunk[]): SQLChunk => {
  const joined = sqlJoin(conditions, " OR ");
  return { sql: `(${joined.sql})`, params: joined.params };
};

export const not = (condition: SQLChunk): SQLChunk => ({
  sql: `NOT (${condition.sql})`,
  params: condition.params,
});

export const asc = (column: string | ColumnConfig): SQLChunk =>
  sql`"${rawSql(colName(column))}" ASC`;

export const desc = (column: string | ColumnConfig): SQLChunk =>
  sql`"${rawSql(colName(column))}" DESC`;

