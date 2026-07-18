# @bungres/kit

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
