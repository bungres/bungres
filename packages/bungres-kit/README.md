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
import { defineConfig } from "@bungres/kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./bungres", // Directory for migrations & generated files
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
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
| `bungres fresh` | Drop all tables and re-run all migrations from scratch |
| `bungres refresh` | Truncate all tables to quickly reset data without dropping schema |
| `bungres seed` | Execute the seed script to populate the database |
| `bungres studio` | Start a local web interface to browse database data |
| `bungres tusky` | Boot up a Node REPL connected to the database with schema loaded |
| `bungres drop` | Drop all tables defined in the schema (prompts for confirmation) |

### Usage Examples

```bash
bun run bungres generate
bun run bungres migrate
bun run bungres push
bun run bungres pull
bun run bungres status
bun run bungres fresh
bun run bungres refresh
bun run bungres seed
bun run bungres studio
bun run bungres tusky
bun run bungres drop --force   # skip confirmation
```

## License
MIT
