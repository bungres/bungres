# @bungres/orm

Type-safe Postgres ORM for [Bun](https://bun.sh), using Bun's native `Bun.SQL` — no external database driver needed! 🐘

Part of the **Bungres** ecosystem. For migrations and CLI tools, see [`@bungres/kit`](https://www.npmjs.com/package/@bungres/kit).

## Requirements

- **Bun ≥ 1.3** (uses `Bun.SQL` which is built-in)
- **Postgres ≥ 16**

## Installation

```bash
bun add @bungres/orm
```

## Quick Start

### 1. Define your schema

```ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamptz,
  unique,
  index,
} from "@bungres/orm";

export const users = pgTable(
  "users",
  {
    id: uuid({ primaryKey: true }),
    email: varchar({ length: 255, notNull: true }),
    username: varchar({ length: 80, notNull: true }),
    fullName: text(),
    verified: boolean({ notNull: true, default: false }),
    createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
  },
  (t) => [
    unique().on(t.email),
    unique().on(t.username),
    index().on(t.createdAt),
  ],
);
```

### 2. Create a DB client

```ts
import { bungres } from "@bungres/orm";

export const db = bungres(Bun.env.DATABASE_URL!);
```

### 3. Querying

```ts
import { eq, and, ilike } from "@bungres/orm";

// SELECT
const user = await db.select().from(users).where(eq(users.id, userId)).single();

// FIND FIRST / FIND MANY (Alternative Syntax)
const userByEmail = await db.users.findFirst({
  where: eq(users.email, "alice@example.com"),
});

// INSERT
const newUser = await db
  .insert(users)
  .values({ email: "alice@example.com", username: "alice" })
  .returning()
  .single();

// UPDATE
const updated = await db
  .update(users)
  .set({ verified: true })
  .where(eq(users.id, userId))
  .returning()
  .single();

// DELETE
await db.delete(users).where(eq(users.id, userId));
```

### 1. Casing API

Automatically convert camelCase JS keys to snake_case DB columns without manually typing names!

```ts
import { pgTable, uuid, varchar, text } from "@bungres/orm";

// Creates "users" table, maps `fullName` to `full_name` automatically!
export const users = pgTable("users", {
  id: uuid({ primaryKey: true }),
  email: varchar({ length: 255, notNull: true, unique: true }),
  fullName: text(),
});
```

### 2. Column Aliases

Easily alias columns in your selects!

```ts
const rows = await db
  .select(users.id, users.fullName.as("userName"))
  .from(users);
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
export const users = pgTable("users", {
  id: uuid({ primaryKey: true }),
  name: text(),
});

export const groups = pgTable("groups", {
  id: uuid({ primaryKey: true }),
  name: text(),
});

export const userGroups = pgTable("user_groups", {
  id: uuid({ primaryKey: true }),
  userId: uuid({ references: { table: "users", column: "id" } }),
  groupId: uuid({ references: { table: "groups", column: "id" } }),
});

const db = bungres({ url: DB_URL, schema: { users, groups, userGroups } });

// Easily pull many-to-many relationships!
const result = await db.users.findMany({
  with: {
    groups: true, // "groups" relation automatically discovered through user_groups junction!
  },
});
```

## Advanced Features

### 1. 100% Schema Parity

Bungres supports advanced Postgres schema definitions seamlessly:

```ts
import {
  pgTable,
  pgEnum,
  pgView,
  text,
  integer,
  customType,
} from "@bungres/orm";

export const roles = pgEnum("roles", ["admin", "user"]);

const citext = customType<string>("citext");

export const users = pgTable("users", {
  role: roles("role").default("user"),
  tags: text("tags").array(), // Arrays!
  email: citext("email").unique(), // Custom extensions
  fullName: text("full_name").generatedAlwaysAs(
    "first_name || ' ' || last_name",
  ), // Postgres 12+ generated
});

// Views and Materialized Views
export const activeUsers = pgView(
  "active_users",
  db.select().from(users).where(eq(users.role, "admin")),
);
```

### 2. Advanced Querying Power

We support Subqueries, CTEs, Window Functions, and Set Operations:

```ts
import { withCte, union, over, sum } from "@bungres/orm";

// CTEs
const regionalSales = withCte("regional_sales").as(
  db.select().from(sales).where(eq(sales.region, "NA")),
);

const rows = await db.with(regionalSales).select().from(regionalSales);

// Window Functions
const result = await db
  .select(
    users.name,
    over(sum(orders.total))
      .partitionBy(users.department)
      .orderBy(orders.createdAt)
      .as("dept_total"),
  )
  .from(users)
  .leftJoin(orders, eq(users.id, orders.customerId));
```

### 3. Native Postgres Operators

Query JSONB, Arrays, and Full Text Search naturally:

```ts
import {
  containsJson,
  arrayContains,
  tsMatch,
  toTsvector,
  plainToTsquery,
} from "@bungres/orm";

// JSONB
db.select()
  .from(users)
  .where(containsJson(users.metadata, { role: "admin" }));

// Arrays
db.select()
  .from(posts)
  .where(arrayContains(posts.tags, ["javascript"]));

// Full Text Search
db.select()
  .from(articles)
  .where(tsMatch(toTsvector(articles.body), plainToTsquery("bun orm")));
```

### 4. Nested Transactions (Savepoints)

Start a transaction inside an existing transaction! Bungres automatically uses Postgres `SAVEPOINT`s to allow inner blocks to roll back without destroying outer progress.

```ts
const result = await db.transaction(async (tx) => {
  await tx.insert(users).values(data);

  try {
    // Automatically creates a SAVEPOINT instead of BEGIN
    await tx.transaction(async (nested) => {
      await nested.insert(logs).values({ msg: "User created" });
      throw new Error("Oops"); // Rolls back ONLY the log insert
    });
  } catch (e) {
    // User insert is completely safe!
  }
});
```

### Raw SQL

```ts
// Tagged template — fully parameterized
import { sql } from "@bungres/orm";

const chunk = sql`SELECT * FROM "users" WHERE email = ${email}`;
const rows = await db.execute(chunk);

// Raw string (for DDL or trusted queries)
const rows = await db.raw(`SELECT COUNT(*) FROM "users"`);
```

### Condition helpers

```ts
import {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  ilike,
  isNull,
  isNotNull,
  inArray,
  and,
  or,
  not,
} from "@bungres/orm";

db.select(posts).where(
  and(
    eq("published", true),
    or(ilike("title", "%bun%"), ilike("body", "%bun%")),
  ),
);
```

## License

MIT
