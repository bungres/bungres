---
"@bungres/orm": major
---

# 🚀 Bungres ORM v1.0.0 is here!

We've completely overhauled `@bungres/orm` to achieve **100% feature parity** with industry-standard ORMs like Drizzle, while remaining hyper-optimized for Bun and Postgres!

## 💎 Core Highlights
- **Zero Dependencies:** Built entirely on top of Bun's blazing-fast native `Bun.SQL`. No external database drivers needed.
- **Prisma-like Relational API:** Fetch deeply nested relations with zero boilerplate (e.g. `db.users.findMany({ with: { posts: true } })`).
- **Fully Typed Query Builder:** Write complex SQL in TypeScript with full auto-complete and type safety.
- **SQL Commenter:** Built-in `.comment()` helper for advanced query profiling.

## 🌟 What's New in v1.0.0

### 1. 100% Postgres Schema Parity
- **Advanced Types & Arrays:** Added 30+ Postgres types, including `jsonb`, `timestamptz`, `inet`, and more. Added a seamless `.array()` modifier for any column type (e.g. `text("tags").array()`).
- **Enums, Views & Materialized Views:** Define complex schema artifacts directly in TypeScript using `pgEnum`, `pgView`, and `pgMaterializedView`.
- **Generated Columns:** Added support for Postgres 12+ generated columns via `.generatedAlwaysAs()`.
- **Custom Types:** Added a `customType<T>()` escape hatch for extensions like PostGIS or pgvector.
- **Constraints:** Comprehensive support for composite primary keys, table-level CHECK constraints, and `.onDelete("cascade")` for foreign keys.

### 2. Unlocked Query Power
- **CTEs & Subqueries:** Full support for `WITH` clauses and Common Table Expressions via the `withCte` API.
- **Window Functions:** Unlocked advanced analytics with the new `over()` function allowing `PARTITION BY` and `ORDER BY` for aggregates.
- **Set Operations:** Added `union()`, `unionAll()`, `intersect()`, and `except()`.

### 3. Native Postgres Operators
- **JSONB Operators:** Use `containsJson`, `hasKey`, `hasAnyKeys` for deep JSON querying.
- **Array Operators:** Query arrays natively using `arrayContains`, `arrayContained`, and `arrayOverlaps`.
- **Full Text Search:** Out-of-the-box support for `toTsvector`, `plainToTsquery`, and `tsMatch` (the `@@` operator).

### 4. Advanced Transactions
- **Nested Transactions:** You can now safely nest transactions! Bungres automatically orchestrates `SAVEPOINT`s under the hood to ensure inner mutations can roll back without affecting the outer transaction's progress.
- **Upserts:** Added `onConflictDoUpdate()` and `onConflictDoNothing()` to `InsertBuilder`.
