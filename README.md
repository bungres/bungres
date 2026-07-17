# Bungres

Type-safe Postgres ORM + CLI toolkit for [Bun](https://bun.sh), using Bun's native `Bun.sql` — no external database driver needed.

| Package | Description |
|---|---|
| `@bungres/orm` | Core ORM — schema definition, query builder, DB client |
| `@bungres/kit` | CLI toolkit — generate, migrate, push, pull, status, drop |

---

## Requirements

- **Bun ≥ 1.3** (uses `Bun.sql` natively under the hood)
- **Postgres ≥ 16**

---

## Quick start

```bash
# Install from the monorepo root
bun install

# Set your database URL
export DATABASE_URL="postgres://user:password@localhost:5432/mydb"

# Define your schema (see examples/blog/src/db/schema/)
# Then push it straight to the DB (great for development):
bun run bungres push

# Or generate a migration file and run it:
bun run bungres generate
bun run bungres migrate
```

---

## @bungres/orm

### Defining a schema

```ts
import { snakeCase, uuid, varchar, text, boolean, timestamptz, unique, index } from "@bungres/orm";

export const users = snakeCase.table("users", {
  id: uuid({ primaryKey: true }),
  email: varchar({ length: 255, notNull: true }),
  username: varchar({ length: 80, notNull: true }),
  fullName: text(),
  verified: boolean({ notNull: true, default: false }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
}, (t) => [
  unique().on(t.email),
  unique().on(t.username),
  index().on(t.createdAt)
]);
```

### Creating a DB client

```ts
import { createDB } from "@bungres/orm";

export const db = createDB(process.env.DATABASE_URL!);
```

### Querying

```ts
import { eq, and, ilike } from "@bungres/orm";

// SELECT
const user = await db.select().from(users).where(eq(users.id, userId)).single();

// FIND FIRST / FIND MANY (Alternative Syntax)
const userByEmail = await db.users.findFirst({
  where: eq(users.email, "alice@example.com")
});

// INSERT
const newUser = await db.insert(users)
  .values({ email: "alice@example.com", username: "alice" })
  .returning()
  .single();

// UPDATE
const updated = await db.update(users)
  .set({ verified: true })
  .where(eq(users.id, userId))
  .returning()
  .single();

// DELETE
await db.execute(db.delete(users).where(eq(users.id, userId)));
```

### Transactions

```ts
const result = await db.transaction(async (tx) => {
  const post = await tx.execute(tx.insert(posts).values(data).returning());
  await tx.execute(tx.update(users).set({ postCount: n + 1 }).where(eq("id", authorId)));
  return post[0];
});
```

### Raw SQL

```ts
// Tagged template — fully parameterized
import { sql } from "@bungres/orm";

const chunk = sql`SELECT * FROM "users" WHERE email = ${email}`;
const rows  = await db.execute(chunk);

// Raw string (for DDL or trusted queries)
const rows = await db.raw(`SELECT COUNT(*) FROM "users"`);
```

### Condition helpers

```ts
import { eq, ne, gt, gte, lt, lte, like, ilike, isNull, isNotNull, inArray, and, or, not } from "@bungres/orm";

db.select(posts).where(
  and(
    eq("published", true),
    or(ilike("title", "%bun%"), ilike("body", "%bun%"))
  )
)
```

### Type inference

```ts
import type { InferTable, InferInsert } from "@bungres/orm";

type User    = InferTable<typeof users>;   // full row
type NewUser = InferInsert<typeof users>;  // insert shape (PKs/defaults optional)
```

## Version 1.0 Features 🌟

### 1. Casing API

Automatically convert camelCase JS keys to snake_case DB columns without manually typing names!

```ts
import { snakeCase } from "@bungres/orm";
import { uuid, varchar, text } from "@bungres/orm";

export const users = snakeCase.table("users", {
  id: uuid({ primaryKey: true }),
  fullName: text(), // Automatically becomes `full_name`!
});
```

### 2. Column Aliases

Easily alias columns in your selects!

```ts
const rows = await db.select(users.id, users.fullName.as("userName")).from(users);
```

### 3. SQL Commenter

Add comments to your generated SQL for better debugging and query profiling.

```ts
db.select(users).comment("Get user list for dashboard");
```

### 4. Zero-Boilerplate Many-to-Many Relations

Bungres automatically detects junction tables based on foreign keys!

```ts
// Easily pull many-to-many relationships!
const result = await db.users.findMany({
  with: {
    groups: true // automatically resolved through user_groups junction!
  }
});
```

---

## @bungres/kit CLI

### Config file — `bungres.config.ts`

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

### Commands

| Command | Description |
|---|---|
| `bungres generate` | Write a timestamped `.sql` migration file from your schema |
| `bungres migrate` | Run pending `.sql` files, track applied in `__bungres_migrations` |
| `bungres push` | Apply schema directly to DB — no files (dev/prototyping) |
| `bungres pull` | Introspect the DB and generate TypeScript schema |
| `bungres status` | Show applied vs pending migrations |
| `bungres fresh` | Drop all tables and re-run all migrations from scratch |
| `bungres refresh` | Truncate all tables to quickly reset data without dropping schema |
| `bungres seed` | Execute the seed script to populate the database |
| `bungres studio` | Start a local web interface to browse database data |
| `bungres tusky` | Boot up a Node REPL connected to the database with schema loaded |
| `bungres drop` | Drop all tables defined in the schema (prompts for confirmation) |

```bash
bungres generate
bungres migrate
bungres push
bungres pull
bungres status
bungres fresh
bungres refresh
bungres seed
bungres studio
bungres tusky
bungres drop --force   # skip confirmation
bungres --help
```

---

## Project structure

```
bungres/
├── packages/
│   ├── @bungres/orm/          # Core ORM
│   │   └── src/
│   │       ├── core/       # Database client, query execution
│   │       ├── builders/   # Select/Insert/Update/Delete builders
│   │       ├── schema/     # Column/Table definitions & factory functions
│   │       ├── types/      # Inference types
│   │       ├── ddl.ts      # CREATE/DROP/ALTER DDL generation
│   │       └── index.ts    # Public API
│   └── @bungres/kit/          # CLI
│       └── src/
│           ├── cli.ts      # CLI entrypoint (`bungres` binary)
│           ├── config.ts   # Config loader
│           ├── schema-loader.ts
│           └── commands/
│               ├── push.ts
│               ├── generate.ts
│               ├── migrate.ts
│               ├── pull.ts
│               ├── status.ts
│               └── drop.ts
├── examples/
│   └── blog/               # Full example — users, posts, comments
├── bungres.config.ts         # Root-level config template
└── package.json            # Bun workspaces monorepo root
```
