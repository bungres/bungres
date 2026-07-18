---
"@bungres/kit": minor
"@bungres/orm": minor
---

### @bungres/orm

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
