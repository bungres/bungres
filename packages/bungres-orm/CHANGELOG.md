# @bungres/orm

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
