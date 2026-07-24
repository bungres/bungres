# @bungres/kit

CLI toolkit for [`@bungres/orm`](https://www.npmjs.com/package/@bungres/orm) — initialize, check, generate, migrate, push, pull, status, seed, studio, and drop your database schema with ease. 🐘✨

## Requirements

- **Bun ≥ 1.3** (uses `Bun.SQL` which is built-in)
- **Postgres ≥ 16**
- Built to work alongside `@bungres/orm`.

## Installation

```bash
bun add -d @bungres/kit
```

## Configuration

Create a `bungres.config.ts` file at the root of your project:

```ts
import { defineConfig } from "@bungres/kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./bungres", // Directory for migrations & generated files
  dbCredentials: {
    url: Bun.env.DATABASE_URL!,
  },
});
```

## Commands Overview

Run the CLI using Bun:

```bash
bun run bungres --help
```

| Command            | Description                                                                        |
| ------------------ | ---------------------------------------------------------------------------------- |
| `bungres init`     | Initialize bungres project with config file and db folder structure                |
| `bungres check`    | Check for ungenerated schema changes or pending DB migrations (CI drift tool)      |
| `bungres generate` | Write a single timestamped `.sql` migration file with UP/DOWN sections             |
| `bungres migrate`  | Run pending `.sql` UP sections, track applied in `__bungres_migrations`            |
| `bungres rollback` | Automatically revert the last applied migration using its DOWN section             |
| `bungres push`     | Apply schema directly to DB — no files (great for dev/prototyping)                 |
| `bungres pull`     | Introspect the DB and generate TypeScript schema                                   |
| `bungres status`   | Show applied vs pending migrations                                                 |
| `bungres fresh`    | Drop all tables and re-run all migrations from scratch                             |
| `bungres refresh`  | Truncate all tables to quickly reset data without dropping schema                  |
| `bungres seed`     | Execute the seed script, or run the Auto-Seeder using built-in mock fallback       |
| `bungres studio`   | Start a local web interface to browse database data                                |
| `bungres tusky`    | Boot up a Node REPL connected to the database with schema loaded                   |
| `bungres drop`     | Drop all tables, enums, and views defined in the schema (prompts for confirmation) |

### Command Line Flags

- `-c, --config <path>`: Path to custom config file (default: `bungres.config.ts`)
- `-v, --verbose`: Enable verbose SQL statement logging
- `-y, --yes`: Bypass confirmation prompts (non-interactive mode / CI)
- `-f, --force`: Bypass confirmation prompts for `drop` / `push`
- `-h, --help`: Display CLI help text

### Usage Examples

```bash
bun run bungres init
bun run bungres check          # Check schema drift in CI pipeline (exit 0 clean, 1 if drift)
bun run bungres generate -y    # Generate migration without interactive prompts
bun run bungres migrate
bun run bungres rollback
bun run bungres push -y        # Apply schema directly to DB in dev
bun run bungres pull
bun run bungres status
bun run bungres fresh
bun run bungres refresh
bun run bungres seed
bun run bungres studio
bun run bungres tusky
bun run bungres drop -f        # Skip confirmation
```

## Programmatic API

Use `@bungres/kit` in code without the CLI:

```ts
import { loadConfig, loadSchemas, diffSchemas, runMigrate, runCheck } from "@bungres/kit";

const config = await loadConfig();
const isClean = await runCheck(config);

if (!isClean) {
  console.log("Schema changes needed!");
}
```

## Features ✨

- **CI/CD Drift Detection**: `bungres check` detects schema drift or pending DB migrations to keep your builds safe.
- **Non-Interactive Execution**: Use `-y` / `--yes` flags or run in CI environments without prompt blocking.
- **Interactive Terminal UI**: Interactive prompts and spinners powered by `@clack/prompts`.
- **Drizzle-Style Diffs**: Before applying or generating migrations, visually inspect exactly what tables, columns, and enums will be added, dropped, or altered.
- **Enum Alterations**: Native support for enum value expansions via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
- **Rollbacks**: Single file migrations with `-- ==== UP ====` and `-- ==== DOWN ====` sections allow you to rollback your schema effortlessly.
- **Advanced Types & Views**: Full native Postgres support for `pgEnum`, Arrays, `pgView`, and `pgMaterializedView`. The differ natively tracks view signature changes and emits safe `DROP` / `CREATE` generation.
- **Intelligent Casting**: Alters column data types seamlessly by automatically managing and restoring `DEFAULT` constraints across incompatible type casts.
- **Auto-Seeder**: Run `bungres seed` without a custom script to automatically generate mock data for your database with auto FK resolution.

## License

MIT
