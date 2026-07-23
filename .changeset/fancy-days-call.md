---
"@bungres/orm": minor
---

- Added comprehensive integration tests for Postgres data types, custom enums, standard/materialized views, aggregations, and relational queries (One-to-One, One-to-Many).
- Added object literal aliasing support to `SelectBuilder` for easier SQL function fetching (e.g., `db.select({ total: sum(orders.amount) })`).
- Fixed a bug in the Relational API where correlated subqueries referenced fully qualified table names instead of their internal query aliases, leading to PostgreSQL execution errors.
- Fixed a TypeScript inference bug in `ExtractManyToManyRelations` which caused valid relations to be dropped from `WithConfig` intellisense.
- Fixed `TableConfigImpl` TypeScript compilation errors related to strict `exactOptionalPropertyTypes` checks on the `schema` property.
