import { DeleteBuilder } from "../builders/delete.js";
import { InsertBuilder } from "../builders/insert.js";
import { RelationalQueryBuilder } from "../builders/relational.js";
import { SelectBuilder, SelectBuilderIntermediate, type SelectedFields } from "../builders/select.js";
import { UpdateBuilder } from "../builders/update.js";
import { type Table } from "../schema/table.js";
import type { ColumnConfig } from "../types/index.js";
import type { SchemaConfig } from "../types/relations.js";
import { TableConfigSymbol } from "../utils/constants.js";
import { BungresError, ConnectionError, QueryError, TransactionError } from "../utils/errors.js";
import type { QueryExecutor } from "./query.js";
import type { SQLChunk } from "./sql.js";

// ---------------------------------------------------------------------------
// BaseQueryExecutor — shared query builder factory methods
// ---------------------------------------------------------------------------

export abstract class BaseQueryExecutor implements QueryExecutor {
  abstract execute<T = Record<string, unknown>>(builder: { toSQL(): SQLChunk } | SQLChunk): Promise<T[]>;
  abstract executeSingle<T = Record<string, unknown>>(builder: { toSQL(): SQLChunk } | SQLChunk): Promise<T | null>;
  abstract raw<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;

  select(): SelectBuilderIntermediate;
  select<TSelection extends SelectedFields>(fields: TSelection): SelectBuilderIntermediate<TSelection>;
  select<TColumns extends Record<string, ColumnConfig>>(table: Table<string, TColumns>): SelectBuilder<TColumns>;
  select<TColumns extends Record<string, ColumnConfig>>(
    tableOrFields?: Table<string, TColumns> | SelectedFields
  ): SelectBuilder<TColumns> | SelectBuilderIntermediate | SelectBuilderIntermediate<SelectedFields> {
    if (tableOrFields) {
      if (TableConfigSymbol in tableOrFields) {
        return new SelectBuilder(tableOrFields as Table<string, TColumns>, this);
      }
      return new SelectBuilderIntermediate(this, tableOrFields as SelectedFields);
    }
    return new SelectBuilderIntermediate(this) as unknown as SelectBuilderIntermediate<SelectedFields>;
  }

  insert<TColumns extends Record<string, ColumnConfig>>(table: Table<string, TColumns>): InsertBuilder<TColumns> {
    return new InsertBuilder(table, this);
  }

  update<TColumns extends Record<string, ColumnConfig>>(table: Table<string, TColumns>): UpdateBuilder<TColumns> {
    return new UpdateBuilder(table, this);
  }

  delete<TColumns extends Record<string, ColumnConfig>>(table: Table<string, TColumns>): DeleteBuilder<TColumns> {
    return new DeleteBuilder(table, this);
  }
}

// ---------------------------------------------------------------------------
// BungresDB — main client
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
  /** Query execution timeout in ms */
  queryTimeout?: number;
  /** Whether to log executed queries or custom log callback */
  logQueries?: boolean | ((sql: string, params: unknown[], durationMs: number) => void);
  /** Whether to include execution timing in log output */
  logQueryTiming?: boolean;
}

export type TransactionOptions = {
  isolation?: "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate PostgreSQL connection string format */
export function validateConnectionString(url: string): void {
  if (!url || typeof url !== "string" || (!url.startsWith("postgres://") && !url.startsWith("postgresql://"))) {
    throw new ConnectionError(
      `Invalid Postgres connection string: "${url}". Expected URL starting with postgres:// or postgresql://`
    );
  }
  try {
    new URL(url);
  } catch (e) {
    throw new ConnectionError(`Invalid Postgres connection string format: "${url}"`, { cause: e });
  }
}

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
  validateConnectionString(url);
  const dbName = parseDBName(url);
  if (!dbName || dbName === "postgres") return;

  let maintenance: InstanceType<typeof Bun.SQL>;
  try {
    maintenance = new Bun.SQL(maintenanceUrl(url), { max: 1 });
  } catch (err) {
    throw new ConnectionError(`Failed to connect to maintenance database for "${url}"`, { cause: err });
  }

  try {
    // Check existence first — CREATE DATABASE cannot run inside a transaction
    const rows = await maintenance.unsafe(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if ((rows as unknown[]).length === 0) {
      // Identifiers can't be parameterised in Postgres DDL — dbName comes
      // from the user-supplied URL so we validate it first.
      if (!/^[a-zA-Z_][a-zA-Z0-9_$-]*$/.test(dbName)) {
        throw new ConnectionError(`Invalid database name: "${dbName}"`);
      }
      await maintenance.unsafe(`CREATE DATABASE "${dbName}"`);
      console.log(`bungres: created database "${dbName}"`);
    }
  } catch (err: any) {
    if (err instanceof BungresError) throw err;
    throw new ConnectionError(`Database creation failed for "${dbName}": ${err.message}`, { cause: err });
  } finally {
    await maintenance.end();
  }
}

// ---------------------------------------------------------------------------
// BungresDB
// ---------------------------------------------------------------------------

export class BungresDB extends BaseQueryExecutor {
  private readonly _sql: InstanceType<typeof Bun.SQL>;
  private readonly _config: DBConfig;
  private _ready: Promise<void> | null = null;
  private _lastQuery: { sql: string; params: unknown[]; duration: number } | null = null;
  private _activeQueries = 0;

  constructor(config: DBConfig | string) {
    super();
    const url = typeof config === "string" ? config : config.url;
    validateConnectionString(url);

    const opts: DBConfig = typeof config === "object" ? config : { url };

    this._config = { autoCreateDB: true, ...opts };

    try {
      this._sql = new Bun.SQL(url, {
        max: opts.max ?? 10,
        idleTimeout: opts.idleTimeout ?? 10_000,
        ...(opts.maxLifetime !== undefined && { maxLifetime: opts.maxLifetime }),
        ...(opts.tls !== undefined && { tls: opts.tls }),
      });
    } catch (err) {
      throw new ConnectionError(`Failed to initialize Postgres connection pool for "${url}"`, { cause: err });
    }

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

  /** Get last executed query details */
  getLastQuery(): { sql: string; params: unknown[]; duration: number } | null {
    return this._lastQuery;
  }

  /** Get pool status & metrics */
  getPoolStatus(): { total: number; active: number; idle: number; waiting: number } {
    const sqlAny = this._sql as any;
    if (sqlAny && typeof sqlAny.stats === "object" && sqlAny.stats !== null) {
      return {
        total: sqlAny.stats.total ?? this._config.max ?? 10,
        active: sqlAny.stats.active ?? this._activeQueries,
        idle: sqlAny.stats.idle ?? 0,
        waiting: sqlAny.stats.waiting ?? 0,
      };
    }
    const max = this._config.max ?? 10;
    return {
      total: max,
      active: this._activeQueries,
      idle: Math.max(0, max - this._activeQueries),
      waiting: 0,
    };
  }

  /** Execute low-level query with error handling, logging, and timeouts */
  private async _executeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.ready();
    this._activeQueries++;
    const startTime = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      let queryPromise: Promise<unknown> = this._sql.unsafe(sql, params as string[]);
      const timeoutMs = this._config.queryTimeout;
      if (timeoutMs && timeoutMs > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new QueryError(`Query execution timed out after ${timeoutMs}ms`, { sql, params }));
          }, timeoutMs);
        });
        queryPromise = Promise.race([queryPromise, timeoutPromise]);
      }

      const result = await queryPromise;
      const duration = Date.now() - startTime;
      this._lastQuery = { sql, params, duration };

      if (this._config.logQueries) {
        if (typeof this._config.logQueries === "function") {
          this._config.logQueries(sql, params, duration);
        } else {
          const timingStr = this._config.logQueryTiming ? ` (${duration}ms)` : "";
          console.log(`[bungres] ${sql} ${JSON.stringify(params)}${timingStr}`);
        }
      }

      return Array.from(result as Iterable<T>) as T[];
    } catch (err: any) {
      if (err instanceof BungresError) throw err;
      throw new QueryError(err.message || "Query execution failed", { sql, params, cause: err });
    } finally {
      this._activeQueries = Math.max(0, this._activeQueries - 1);
      if (timer) clearTimeout(timer);
    }
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /** Execute a built query and return all rows */
  async execute<T = Record<string, unknown>>(
    builder: { toSQL(): SQLChunk } | SQLChunk
  ): Promise<T[]> {
    const chunk = "toSQL" in builder ? builder.toSQL() : builder;
    return this._executeQuery<T>(chunk.sql, chunk.params);
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
    return this._executeQuery<T>(query, params);
  }

  /**
   * Run a callback inside a transaction.
   * Automatically rolls back if the callback throws.
   */
  async transaction<T>(
    fn: (tx: BungresTransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    await this.ready();
    try {
      return (await this._sql.transaction(async (txSql: InstanceType<typeof Bun.SQL>) => {
        if (options?.isolation) {
          await txSql.unsafe(`SET TRANSACTION ISOLATION LEVEL ${options.isolation}`);
        }
        const tx = new BungresTransaction(txSql);
        return fn(tx);
      })) as T;
    } catch (err: any) {
      if (err instanceof BungresError) throw err;
      throw new TransactionError(err.message || "Transaction failed", { cause: err });
    }
  }

  /** Close the connection pool */
  async close(): Promise<void> {
    await this._sql.end();
  }
}

// ---------------------------------------------------------------------------
// BungresTransaction — same query API, bound to an active transaction
// ---------------------------------------------------------------------------

export class BungresTransaction extends BaseQueryExecutor {
  private readonly _sql: InstanceType<typeof Bun.SQL>;
  private _savepointCounter = 0;

  constructor(sql: InstanceType<typeof Bun.SQL>) {
    super();
    this._sql = sql;
  }

  private async _executeQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const result = await this._sql.unsafe(sql, params as string[]);
      return Array.from(result) as T[];
    } catch (err: any) {
      if (err instanceof BungresError) throw err;
      throw new QueryError(err.message || "Transaction query execution failed", { sql, params, cause: err });
    }
  }

  async execute<T = Record<string, unknown>>(
    builder: { toSQL(): SQLChunk } | SQLChunk
  ): Promise<T[]> {
    const chunk = "toSQL" in builder ? builder.toSQL() : builder;
    return this._executeQuery<T>(chunk.sql, chunk.params);
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
    return this._executeQuery<T>(query, params);
  }

  /**
   * Run a nested transaction using SAVEPOINT.
   * If the callback throws, it rolls back to the savepoint, leaving the outer transaction intact.
   */
  async transaction<T>(fn: (tx: BungresTransaction) => Promise<T>): Promise<T> {
    this._savepointCounter++;
    const spName = `sp_${this._savepointCounter}`;

    await this._sql.unsafe(`SAVEPOINT ${spName}`);

    try {
      const result = await fn(this);
      await this._sql.unsafe(`RELEASE SAVEPOINT ${spName}`);
      return result;
    } catch (e) {
      await this._sql.unsafe(`ROLLBACK TO SAVEPOINT ${spName}`);
      throw e;
    }
  }
}

export type BungresDBClient<TSchema extends SchemaConfig> = BungresDB & {
  [K in keyof TSchema]: RelationalQueryBuilder<TSchema, K>;
};

/**
 * Idiomatic bungres entrypoint — mirrors the `drizzle(config)` pattern.
 *
 * @example
 * import { bungres } from "@bungres/orm";
 * import * as schema from "./schema";
 *
 * export const db = bungres({ url: Bun.env.DATABASE_URL!, schema });
 */
export function bungres<TSchema extends SchemaConfig = Record<string, never>>(
  config: DBConfig<TSchema> | string
): BungresDBClient<TSchema> {
  const db = new BungresDB(config);

  if (typeof config === "object" && config.schema) {
    const schema = config.schema;
    return new Proxy(db, {
      get(target, prop) {
        if (prop in target) {
          // Bind methods to the target (BungresDB) to avoid 'this' context issues
          const value = (target as unknown as Record<string | symbol, unknown>)[prop];
          if (typeof value === "function") {
            return value.bind(target);
          }
          return value;
        }
        if (typeof prop === "string" && prop in schema) {
          return new RelationalQueryBuilder(target, schema, prop);
        }
        return undefined;
      },
    }) as unknown as BungresDBClient<TSchema>;
  }

  return db as unknown as BungresDBClient<TSchema>;
}

/** @internal kept for internal package use only */
export const createDB = bungres;
