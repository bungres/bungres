# @bungres/orm

## 1.2.1

### Patch Changes

- a918099: - **@bungres/orm**: Fixed PostgreSQL array parameter serialization (`toPgArray`) in `InsertBuilder` and `UpdateBuilder` to properly format array values into valid Postgres array literals (`{"elem1","elem2"}`).
  - **@bungres/kit**: Added validation for migration directory and file existence in `migrate`, `status`, `rollback`, `refresh`, and `generate` commands to handle missing folders or files gracefully without throwing raw `ENOENT` errors.

## 1.2.0

### Minor Changes

- c0b396a: - Added comprehensive integration tests for Postgres data types, custom enums, standard/materialized views, aggregations, and relational queries (One-to-One, One-to-Many).
  - Added object literal aliasing support to `SelectBuilder` for easier SQL function fetching (e.g., `db.select({ total: sum(orders.amount) })`).
  - Fixed a bug in the Relational API where correlated subqueries referenced fully qualified table names instead of their internal query aliases, leading to PostgreSQL execution errors.
  - Fixed a TypeScript inference bug in `ExtractManyToManyRelations` which caused valid relations to be dropped from `WithConfig` intellisense.
  - Fixed `TableConfigImpl` TypeScript compilation errors related to strict `exactOptionalPropertyTypes` checks on the `schema` property.

## 1.1.1

### Patch Changes

- 0d1e1ee: - Update `generateCreateView` in DDL helpers to support legacy snapshots and direct `view.sql` structures.
  - Export `inlineParams` utility from `@bungres/orm` index.

## 1.1.0

### Minor Changes

- fedb26d: ### Drizzle Compatibility & Core Features

  - **Nested Join Results**: Joins (`.innerJoin`, `.leftJoin`, etc.) now automatically reconstruct data into correctly nested relational objects (e.g., `[ { users: {...}, orders: {...} } ]`), matching Drizzle's behavior out-of-the-box.
  - **Table Aliases**: Added the `alias(table, name)` helper function to natively support self-joins and table renaming on the fly.
  - **Subquery Joins**: Added `.as('name')` method to the query builder, allowing select statements to be instantly converted to subqueries and seamlessly passed into `.join()` methods with parameterized variables fully intact.

  ### Bug Fixes & Refinements

  - **SQL Operator Parity**: Updated `inArray` to compile to `IN (...)` rather than `ANY(ARRAY[...])` for stricter alignment with Drizzle outputs.
  - **Native JSON Serialization**: Fixed an issue in `containsJson` where JSON arguments were double-serialized as strings; the native Postgres driver now appropriately binds JavaScript objects directly to `jsonb` parameters.

## 1.0.0

### Major Changes

- 7f6f1f9: # 🚀 Bungres ORM v1.0.0 is here!

  We've completely overhauled `@bungres/orm` to achieve **100% feature parity** with industry-standard ORMs like Drizzle, while remaining hyper-optimized for Bun and Postgres!

  ## 💎 Core Highlights

  - **Zero Dependencies:** Built entirely on top of Bun's blazing-fast native `Bun.SQL`. No external database drivers needed.
  - **Prisma-like Relational API:** Fetch deeply nested relations with zero boilerplate (e.g. `db.users.findMany({ with: { posts: true } })`).
  - **Fully Typed Query Builder:** Write complex SQL in TypeScript with full auto-complete and type safety.
  - **SQL Commenter:** Built-in `.comment()` helper for advanced query profiling.

  ## 🌟 What's New in v1.0.0

  ### 1. 100% Postgres Schema Parity

  - **Advanced Types & Arrays:** Added 30+ Postgres types, including `jsonb`, `timestamptz`, `inet`, and more. Added a seamless `.array()` modifier for any column type (e.g. `text("tags").array()`).
  - **Enums, Views & Materialized Views:** Define complex schema artifacts directly in TypeScript using `pgEnum`, `pgView`, and `pgMaterializedView`.
  - **Generated Columns:** Added support for Postgres 12+ generated columns via `.generatedAlwaysAs()`.
  - **Custom Types:** Added a `customType<T>()` escape hatch for extensions like PostGIS or pgvector.
  - **Constraints:** Comprehensive support for composite primary keys, table-level CHECK constraints, and `.onDelete("cascade")` for foreign keys.

  ### 2. Unlocked Query Power

  - **CTEs & Subqueries:** Full support for `WITH` clauses and Common Table Expressions via the `withCte` API.
  - **Window Functions:** Unlocked advanced analytics with the new `over()` function allowing `PARTITION BY` and `ORDER BY` for aggregates.
  - **Set Operations:** Added `union()`, `unionAll()`, `intersect()`, and `except()`.

  ### 3. Native Postgres Operators

  - **JSONB Operators:** Use `containsJson`, `hasKey`, `hasAnyKeys` for deep JSON querying.
  - **Array Operators:** Query arrays natively using `arrayContains`, `arrayContained`, and `arrayOverlaps`.
  - **Full Text Search:** Out-of-the-box support for `toTsvector`, `plainToTsquery`, and `tsMatch` (the `@@` operator).

  ### 4. Advanced Transactions

  - **Nested Transactions:** You can now safely nest transactions! Bungres automatically orchestrates `SAVEPOINT`s under the hood to ensure inner mutations can roll back without affecting the outer transaction's progress.
  - **Upserts:** Added `onConflictDoUpdate()` and `onConflictDoNothing()` to `InsertBuilder`.

## 0.6.0

### Minor Changes

- 0778c7d: ### @bungres/kit

  - **Fix workspace dependency resolution during publishing** — now uses `bun changeset publish` instead of custom scripts, ensuring `workspace:*` dependencies are properly resolved to actual versions when packages are published to npm
  - **Redesign studio UI with shadcn-style improvements** — compact sidebar, solid backgrounds, proper table headers, and improved pagination controls
  - **Add page size selector to studio** — users can now choose 10, 25, 50, or 100 records per page in the data browser
  - **Improve studio loading states** — reduced flash effect when changing pagination with smooth transitions
  - **Add FK badge support to studio** — foreign key columns now display blue FK badges alongside PK badges
  - **Fix studio table layout** — proper header/footer positioning regardless of record count, full-width pagination footer
  - Add `ecom` example to changeset ignore list

  ### @bungres/orm

  - **New query operators** — added `notIn` and `between` operators to query conditions for more flexible filtering
  - **Export `colName` helper function** — now exported for custom SQL building, allowing users to resolve column references to qualified SQL names
  - **Add `noCasing` option** — new `noCasing.table()` factory for table names without automatic case transformation
  - **Improve SQL comment handling** — sanitize `*/` sequences in comments to prevent SQL injection issues
  - **Add comment support to UPDATE queries** — UPDATE builder now supports SQL comments like SELECT queries
  - **Refactor column name resolution** — centralized `colName` function used across conditions, aggregations, and query builders
  - **Clean up exports** — improved index file exports for better tree-shaking and smaller bundle sizes

## 0.5.0

### Minor Changes

- 88e1a8e: ### @bungres/orm

  - **Renamed `createDB` → `bungres`** — the main entrypoint now mirrors the idiomatic `drizzle(config)` pattern. `createDB` is kept as an internal alias for backwards compatibility.
  - **`table()` now defaults to snake_case** — `table("users", { fullName: ... })` automatically maps to `full_name` in Postgres. The previous `snakeCase.table()` pattern still works.
  - Export `bungres` instead of `createDB` from the public API.

  ### @bungres/kit

  - **Configurable migrations tracking** — added `migrations.table` and `migrations.schema` options to `bungres.config.ts`. Migrations table now lives in a dedicated `bungres` schema (default) instead of `public`.
  - **Breakpoint-aware migration runner** — `migrate` now splits SQL on `--statement-breakpoint` markers when `breakpoints: true` (default), matching drizzle-kit's generated output.
  - **Added `breakpoints` and `strict` config options** — `breakpoints` controls statement splitting; `strict` enables confirmation prompts for destructive operations.
  - **`drop` command uses configurable schema/table** — no longer hardcodes `public.__bungres_migrations`; respects `migrations.schema` and `migrations.table` from config.
  - **`status` command updated** — queries the correct schema-qualified migrations table.
  - **`init` scaffold updated** — generated config uses `process.env.DATABASE_URL` instead of `Bun.env`, and schema template uses `table()` directly instead of `snakeCase.table()`.
  - **`studio` command uses `bungres()` entrypoint** — updated to use the renamed API.
  - Fixed `repository.directory` in both package.json files to match actual folder names.

## 0.4.0

### Minor Changes

- 62fed24: ## @bungres/kit

  ### New: `bungres init` command

  - Added `packages/bungres-kit/src/commands/init.ts` — a new CLI command that bootstraps a bungres project from scratch
  - Creates `bungres.config.ts`, `src/db/schema.ts` (with an example `users` table), and `src/db/client.ts`
  - Registered in `cli.ts` and runs **before** config is loaded (no DB connection needed)

  ### Studio: full overhaul

  - **Pagination** — replaced the hard-coded 100-row cap with proper server-side pagination (`page` / `limit` query params, `totalPages` response)
  - **All columns shown** — data table now derives columns from actual row keys so foreign-key columns and any extra DB columns are never hidden
  - **Font** — switched from Inter → Outfit for a fresher look

  ***

  ## @bungres/orm

  ### New: Aggregation helpers (`count`, `sum`, `avg`, `min`, `max`)

  - Added `packages/bungres-orm/src/core/aggregations.ts`
  - All helpers return typed `SQLChunk<T>` and are exported from the package root

  ### Select builder improvements

  - `groupBy(...columns)` — new method to add `GROUP BY` clauses
  - `having(condition)` — new method to filter grouped results
  - `SelectedFields` type now accepts `SQLChunk` values (aggregation results, raw SQL) in addition to plain columns
  - `InferSelection` updated to correctly infer types for `SQLChunk` values
  - `orderBy` now accepts `SQLChunk` in addition to column names / `ColumnConfig`
  - JOIN storage changed from `string[]` → `(string | SQLChunk)[]`

  ### Conditions & SQL core

  - Minor fixes to `conditions.ts` and `sql.ts` to support the new aggregation / groupBy features
