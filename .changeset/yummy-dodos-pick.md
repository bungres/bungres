---
"@bungres/orm": minor
---

### Drizzle Compatibility & Core Features
- **Nested Join Results**: Joins (`.innerJoin`, `.leftJoin`, etc.) now automatically reconstruct data into correctly nested relational objects (e.g., `[ { users: {...}, orders: {...} } ]`), matching Drizzle's behavior out-of-the-box.
- **Table Aliases**: Added the `alias(table, name)` helper function to natively support self-joins and table renaming on the fly.
- **Subquery Joins**: Added `.as('name')` method to the query builder, allowing select statements to be instantly converted to subqueries and seamlessly passed into `.join()` methods with parameterized variables fully intact.

### Bug Fixes & Refinements
- **SQL Operator Parity**: Updated `inArray` to compile to `IN (...)` rather than `ANY(ARRAY[...])` for stricter alignment with Drizzle outputs.
- **Native JSON Serialization**: Fixed an issue in `containsJson` where JSON arguments were double-serialized as strings; the native Postgres driver now appropriately binds JavaScript objects directly to `jsonb` parameters.
