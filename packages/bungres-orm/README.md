# @bungres/orm

Type-safe Postgres ORM for [Bun](https://bun.sh), using Bun's native `Bun.sql` — no external database driver needed! 🐘

Part of the **Bungres** ecosystem. For migrations and CLI tools, see [`@bungres/kit`](https://www.npmjs.com/package/@bungres/kit).

## Requirements

- **Bun ≥ 1.3** (uses `Bun.sql` which is built-in)
- **Postgres ≥ 16**

## Installation

```bash
bun add @bungres/orm
```

## Quick Start

### 1. Define your schema

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

### 2. Create a DB client

```ts
import { createDB } from "@bungres/orm";

export const db = createDB(process.env.DATABASE_URL!);
```

### 3. Querying

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

### 1. Casing API

Automatically convert camelCase JS keys to snake_case DB columns without manually typing names!

```ts
import { snakeCase } from "@bungres/orm";
import { uuid, varchar, text } from "@bungres/orm";

// Creates "users" table, maps `fullName` to `full_name` automatically!
export const users = snakeCase.table("users", {
  id: uuid({ primaryKey: true }),
  email: varchar({ length: 255, notNull: true, unique: true }),
  fullName: text(),
});
```

### 2. Column Aliases

Easily alias columns in your selects!

```ts
const rows = await db.select(users.id, users.fullName.as("userName")).from(users);
// returns { id: '...', userName: '...' }
```

### 3. SQL Commenter

Add comments to your generated SQL for better debugging and query profiling.

```ts
db.select(users).comment("Get user list for dashboard");
// SELECT ... FROM "users" /* Get user list for dashboard */
```

### 4. Zero-Boilerplate Many-to-Many Relations

Bungres automatically detects junction tables based on foreign keys! Just query your deep relations directly.

```ts
export const users = snakeCase.table("users", {
  id: uuid({ primaryKey: true }),
  name: text(),
});

export const groups = snakeCase.table("groups", {
  id: uuid({ primaryKey: true }),
  name: text(),
});

export const userGroups = snakeCase.table("user_groups", {
  id: uuid({ primaryKey: true }),
  userId: uuid({ references: { table: "users", column: "id" } }),
  groupId: uuid({ references: { table: "groups", column: "id" } }),
});

const db = createDB({ url: DB_URL, schema: { users, groups, userGroups } });

// Easily pull many-to-many relationships!
const result = await db.users.findMany({
  with: {
    groups: true // "groups" relation automatically discovered through user_groups junction!
  }
});
```

## Advanced Features

### Transactions

```ts
const result = await db.transaction(async (tx) => {
  const post = await tx.insert(posts).values(data).returning().single();
  await tx.update(users).set({ postCount: n + 1 }).where(eq(users.id, authorId));
  return post;
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

## License
MIT
