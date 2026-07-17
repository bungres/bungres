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
import { table, uuid, varchar, text, boolean, timestamptz } from "@bungres/orm";

export const users = table("users", {
  id:        uuid("id").primaryKey(),
  email:     varchar("email", 255).notNull().unique(),
  username:  varchar("username", 80).notNull().unique(),
  fullName:  text("full_name"),
  verified:  boolean("verified").notNull().default(false),
  createdAt: timestamptz("created_at").notNull().defaultRaw("NOW()"),
});
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
const user = await db.executeSingle(
  db.select(users).where(eq("id", userId))
);

// INSERT
const newUser = await db.execute(
  db.insert(users)
    .values({ email: "alice@example.com", username: "alice" })
    .returning()
);

// UPDATE
await db.execute(
  db.update(users)
    .set({ verified: true })
    .where(eq("id", userId))
);

// DELETE
await db.execute(
  db.delete(users).where(eq("id", userId))
);
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
export const users = table("users", {
  id: uuid("id", { primaryKey: true }),
  name: text("name"),
});

export const groups = table("groups", {
  id: uuid("id", { primaryKey: true }),
  name: text("name"),
});

export const userGroups = table("user_groups", {
  id: uuid("id", { primaryKey: true }),
  userId: uuid("user_id", { references: { table: "users", column: "id" } }),
  groupId: uuid("group_id", { references: { table: "groups", column: "id" } }),
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

## Column Types Supported

```
text  varchar  char  integer  bigint  smallint  serial  bigserial
boolean  real  doublePrecision  numeric  decimal
json  jsonb  timestamp  timestamptz  date  time  timetz
uuid  bytea  interval  inet  cidr  macaddr
```

## License
MIT
