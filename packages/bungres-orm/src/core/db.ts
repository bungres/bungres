import type { ColumnConfig } from "../types/index.js";
import { type Table, TableConfigSymbol } from "../schema/table.js";
import type { SQLChunk } from "./sql.js";
import { SelectBuilder, SelectBuilderIntermediate, type SelectedFields } from "../builders/select.js";
import { InsertBuilder } from "../builders/insert.js";
import { UpdateBuilder } from "../builders/update.js";
import { DeleteBuilder } from "../builders/delete.js";
import type { QueryExecutor } from "./query.js";
import type { SchemaConfig } from "../types/relations.js";
import { RelationalQueryBuilder } from "../builders/relational.js";

// ---------------------------------------------------------------------------
// BungresDB — the main database client wrapping Bun.SQL (Bun 1.x native)
// ---------------------------------------------------------------------------

export interface DBConfig<TSchema extends SchemaConfig = any> {
  /** Postgres connection URL, e.g. postgres://user:pass@host:5432/dbname */
  url: string;
  /** Max connections in the pool (default: 10) */
  max?: number;
  /** Connection idle timeout in ms (default: 10000) */
  idleTimeout?: number;
  /** Max connection lifetime in ms */
  maxLifetime?: number;
  /** Whether to use TLS (default: auto-detect from URL) */
  tls?: boolean;
  /**
   * Auto-create the database if it doesn't exist (default: true).
   * Connects to the "postgres" maintenance DB to run CREATE DATABASE.
   */
  autoCreateDB?: boolean;
  /**
   * The database schema object (tables). Enables the db.tableName.findMany() relational API.
   */
  schema?: TSchema;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the database name out of a Postgres URL */
function parseDBName(url: string): string {
  try {
    return new URL(url).pathname.slice(1); // strip leading "/"
  } catch {
    return "";
  }
}

/** Build a URL pointing to the maintenance "postgres" database */
function maintenanceUrl(url: string): string {
  try {
    const u = new URL(url);
    u.pathname = "/postgres";
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Ensure the target database exists.
 * Connects to the "postgres" maintenance DB and issues CREATE DATABASE IF NOT EXISTS.
 */
async function ensureDatabase(url: string): Promise<void> {
  const dbName = parseDBName(url);
  if (!dbName || dbName === "postgres") return;

  const maintenance = new Bun.SQL(maintenanceUrl(url), { max: 1 });

  try {
    // Check existence first — CREATE DATABASE cannot run inside a transaction
    const rows = await maintenance.unsafe(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if ((rows as unknown[]).length === 0) {
      // Identifiers can't be parameterised in Postgres DDL — dbName comes
      // from the user-supplied URL so we validate it first.
      if (!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(dbName)) {
        throw new Error(`Invalid database name: "${dbName}"`);
      }
      await maintenance.unsafe(`CREATE DATABASE "${dbName}"`);
      console.log(`bungres: created database "${dbName}"`);
    }
  } finally {
    await maintenance.end();
  }
}

// ---------------------------------------------------------------------------
// BungresDB
// ---------------------------------------------------------------------------

export class BungresDB implements QueryExecutor {
  private readonly _sql: InstanceType<typeof Bun.SQL>;
  private readonly _config: DBConfig;
  private _ready: Promise<void> | null = null;

  constructor(config: DBConfig | string) {
    const url = typeof config === "string" ? config : config.url;
    const opts: DBConfig = typeof config === "object" ? config : { url };

    this._config = { autoCreateDB: true, ...opts };

    this._sql = new Bun.SQL(url, {
      max: opts.max ?? 10,
      idleTimeout: opts.idleTimeout ?? 10_000,
      ...(opts.maxLifetime !== undefined && { maxLifetime: opts.maxLifetime }),
      ...(opts.tls !== undefined && { tls: opts.tls }),
    });

    // Kick off DB creation immediately so first query awaits it
    if (this._config.autoCreateDB !== false) {
      this._ready = ensureDatabase(url).catch((err) => {
        // Non-fatal: if we can't reach maintenance DB, let the real query fail naturally
        console.warn(`bungres: could not auto-create database: ${err.message}`);
      });
    }
  }

  /** Wait for DB-init to complete before running any query */
  private async ready(): Promise<void> {
    if (this._ready) {
      await this._ready;
      this._ready = null; // only run once
    }
  }

  // ── Query builders (synchronous, no DB call) ─────────────────────────────

  select(): SelectBuilderIntermediate;
  select<TSelection extends SelectedFields>(fields: TSelection): SelectBuilderIntermediate<TSelection>;
  select<TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(
    table: Table<string, TColumns>
  ): SelectBuilder<TColumns>;
  select<TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(
    tableOrFields?: Table<string, TColumns> | SelectedFields
  ): any {
    if (tableOrFields) {
      if (TableConfigSymbol in tableOrFields) {
        return new SelectBuilder(tableOrFields as any, this);
      }
      return new SelectBuilderIntermediate(this, tableOrFields as SelectedFields);
    }
    return new SelectBuilderIntermediate(this);
  }

  insert<TColumns extends Record<string, ColumnConfig>>(
    table: Table<string, TColumns>
  ): InsertBuilder<TColumns> {
    return new InsertBuilder(table, this);
  }

  update<TColumns extends Record<string, ColumnConfig>>(
    table: Table<string, TColumns>
  ): UpdateBuilder<TColumns> {
    return new UpdateBuilder(table, this);
  }

  delete<TColumns extends Record<string, ColumnConfig>>(
    table: Table<string, TColumns>
  ): DeleteBuilder<TColumns> {
    return new DeleteBuilder(table, this);
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /** Execute a built query and return all rows */
  async execute<T = Record<string, unknown>>(
    builder: { toSQL(): SQLChunk } | SQLChunk
  ): Promise<T[]> {
    await this.ready();
    const chunk = "toSQL" in builder ? builder.toSQL() : builder;
    const result = await this._sql.unsafe(chunk.sql, chunk.params as string[]);
    return Array.from(result) as T[];
  }

  /** Execute a built query and return the first row or null */
  async executeSingle<T = Record<string, unknown>>(
    builder: { toSQL(): SQLChunk } | SQLChunk
  ): Promise<T | null> {
    const rows = await this.execute<T>(builder);
    return rows[0] ?? null;
  }

  /** Execute raw SQL string */
  async raw<T = Record<string, unknown>>(
    query: string,
    params: unknown[] = []
  ): Promise<T[]> {
    await this.ready();
    const result = await this._sql.unsafe(query, params as string[]);
    return Array.from(result) as T[];
  }

  /**
   * Run a callback inside a transaction.
   * Automatically rolls back if the callback throws.
   */
  async transaction<T>(fn: (tx: BungresTransaction) => Promise<T>): Promise<T> {
    await this.ready();
    return this._sql.transaction(async (txSql: InstanceType<typeof Bun.SQL>) => {
      const tx = new BungresTransaction(txSql);
      return fn(tx);
    }) as Promise<T>;
  }

  /** Close the connection pool */
  async close(): Promise<void> {
    await this._sql.end();
  }
}

// ---------------------------------------------------------------------------
// BungresTransaction — same query API, bound to an active transaction
// ---------------------------------------------------------------------------

export class BungresTransaction implements QueryExecutor {
  private readonly _sql: InstanceType<typeof Bun.SQL>;

  constructor(sql: InstanceType<typeof Bun.SQL>) {
    this._sql = sql;
  }

  select(): SelectBuilderIntermediate;
  select<TSelection extends SelectedFields>(fields: TSelection): SelectBuilderIntermediate<TSelection>;
  select<TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(
    table: Table<string, TColumns>
  ): SelectBuilder<TColumns>;
  select<TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(
    tableOrFields?: Table<string, TColumns> | SelectedFields
  ): any {
    if (tableOrFields) {
      if (TableConfigSymbol in tableOrFields) {
        return new SelectBuilder(tableOrFields as any, this);
      }
      return new SelectBuilderIntermediate(this, tableOrFields as SelectedFields);
    }
    return new SelectBuilderIntermediate(this);
  }

  insert<TColumns extends Record<string, ColumnConfig>>(
    table: Table<string, TColumns>
  ): InsertBuilder<TColumns> {
    return new InsertBuilder(table, this);
  }

  update<TColumns extends Record<string, ColumnConfig>>(
    table: Table<string, TColumns>
  ): UpdateBuilder<TColumns> {
    return new UpdateBuilder(table, this);
  }

  delete<TColumns extends Record<string, ColumnConfig>>(
    table: Table<string, TColumns>
  ): DeleteBuilder<TColumns> {
    return new DeleteBuilder(table, this);
  }

  async execute<T = Record<string, unknown>>(
    builder: { toSQL(): SQLChunk } | SQLChunk
  ): Promise<T[]> {
    const chunk = "toSQL" in builder ? builder.toSQL() : builder;
    const result = await this._sql.unsafe(chunk.sql, chunk.params as string[]);
    return Array.from(result) as T[];
  }

  async executeSingle<T = Record<string, unknown>>(
    builder: { toSQL(): SQLChunk } | SQLChunk
  ): Promise<T | null> {
    const rows = await this.execute<T>(builder);
    return rows[0] ?? null;
  }

  async raw<T = Record<string, unknown>>(
    query: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const result = await this._sql.unsafe(query, params as string[]);
    return Array.from(result) as T[];
  }
}

export type BungresDBClient<TSchema extends SchemaConfig> = BungresDB & {
  [K in keyof TSchema]: RelationalQueryBuilder<TSchema, K>;
};

/** Create a BungresDB instance — main entrypoint */
export function createDB<TSchema extends SchemaConfig = any>(config: DBConfig<TSchema> | string): BungresDBClient<TSchema> {
  const db = new BungresDB(config);

  if (typeof config === "object" && config.schema) {
    const schema = config.schema;
    return new Proxy(db, {
      get(target, prop) {
        if (prop in target) {
          // Bind methods to the target (BungresDB) to avoid 'this' context issues
          const value = (target as any)[prop];
          if (typeof value === 'function') {
            return value.bind(target);
          }
          return value;
        }
        if (typeof prop === "string" && prop in schema) {
          return new RelationalQueryBuilder(target, schema, prop);
        }
        return undefined;
      }
    }) as any;
  }

  return db as any;
}
