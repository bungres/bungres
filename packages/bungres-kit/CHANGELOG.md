# @bungres/kit

## 1.0.0

### Patch Changes

- Updated dependencies [7f6f1f9]
  - @bungres/orm@1.0.0

## 0.7.0

### Minor Changes

- 70b2ec7: - **New Command**: Added `bungres rollback` to easily revert the last applied database migration.
  - **Studio Overhaul**: Completely modernized the `bungres studio` interface with a beautiful dark UI (Shadcn aesthetic). The data tables are now much smarter, displaying native data types and color-coded constraint badges (PK, FK, UQ, IDX) directly in the headers. Performance has also drastically improved thanks to a lean HTMX + Alpine.js architecture powered natively by Bun's HTML bundler.

## 0.6.2

### Patch Changes

- 8ca5846: - Fix workspace dependency resolution in published packages

## 0.6.1

### Patch Changes

- a97599f: Fix workspace dependency resolution in published packages

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

### Patch Changes

- Updated dependencies [0778c7d]
  - @bungres/orm@0.6.0

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

### Patch Changes

- Updated dependencies [88e1a8e]
  - @bungres/orm@0.5.0

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

### Patch Changes

- Updated dependencies [62fed24]
  - @bungres/orm@0.4.0
