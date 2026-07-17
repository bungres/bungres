# @bungres/kit

CLI toolkit for [`@bungres/orm`](https://www.npmjs.com/package/@bungres/orm) — generate, migrate, push, pull, status, and drop your database schema with ease. 🐘✨

## Requirements

- **Bun ≥ 1.3** (uses `Bun.sql` which is built-in)
- **Postgres ≥ 16**
- Built to work alongside `@bungres/orm`.

## Installation

```bash
bun add -d @bungres/kit
```

## Configuration

Create a `bungres.config.ts` file at the root of your project:

```ts
import type { BungresKitConfig } from "@bungres/kit";

const config: BungresKitConfig = {
  // dbUrl: "postgres://...",   // or set DATABASE_URL env var
  schema: "src/db/schema/**/*.ts",
  migrationsDir: "./migrations",
  outDir: "./src/db/generated",
  dbSchema: "public",
  verbose: false,
};

export default config;
```

## Commands Overview

Run the CLI using Bun:

```bash
bun run bungres --help
```

| Command | Description |
|---|---|
| `bungres generate` | Write a timestamped `.sql` migration file from your schema |
| `bungres migrate` | Run pending `.sql` files, track applied in `__bungres_migrations` |
| `bungres push` | Apply schema directly to DB — no files (great for dev/prototyping) |
| `bungres pull` | Introspect the DB and generate TypeScript schema |
| `bungres status` | Show applied vs pending migrations |
| `bungres drop` | Drop all tables defined in the schema (prompts for confirmation) |

### Usage Examples

```bash
bun run bungres generate
bun run bungres migrate
bun run bungres push
bun run bungres pull
bun run bungres status
bun run bungres drop --force   # skip confirmation
```

## License
MIT
