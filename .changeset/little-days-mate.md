---
"@bungres/kit": minor
---

### Bungres Studio Redesign & New Features

Bungres Studio has been completely redesigned from the ground up with a sleek, premium dark-mode aesthetic and several powerful new features:

- **Multi-Tab Interface:** You can now open multiple tables and query editors simultaneously and easily switch between them.
- **Database Introspection:** The sidebar now dynamically discovers all database schemas, tables, views, and materialized views directly from PostgreSQL, complete with real-time row counts.
- **SQL Query Editor:** A new fully functional SQL query editor tab. You can execute raw SQL (or use `Ctrl+Enter`) and instantly see your results in the data grid.
- **JSON Data Viewer:** Complex objects and arrays in the table are now clickable. Clicking them opens a cleanly formatted, copyable JSON modal for easy inspection.
- **Enhanced Data Grid:** Added dynamic PostgreSQL datatype detection and explicit colored badges for Primary Keys (`PK`), Indexes (`IDX`), Unique columns (`UQ`), and Foreign Keys (`FK`) next to column headers.
- **Performance:** Pagination and infinite scrolling controls have been completely refactored to use HTMX out-of-band swaps for blazing fast navigation.

### Migration Engine & CLI Enhancements

- **Enum Support:** The migration differ now officially tracks and generates state for PostgreSQL `ENUM` types (`CREATE TYPE` / `DROP TYPE`). Enums are guaranteed to be generated *before* tables to safely resolve dependencies.
- **View Support:** Added full tracking and generation for standard `VIEW`s and `MATERIALIZED VIEW`s. Views are automatically generated *after* tables.
- **Robust Type Casting:** Fixed a migration bug regarding `ALTER COLUMN TYPE`. The differ now safely drops any `DEFAULT` constraints before casting the column type, and reapplies them afterwards, preventing casting collision errors (e.g. `time without time zone` casting issues).
- **Snapshot Architecture:** Upgraded the `.snapshot.json` internal structure to cleanly isolate `tables`, `enums`, and `views` metadata for much more reliable state comparisons.
- **Complete Teardowns:** The `bungres drop` command has been upgraded to discover and drop Enums and Views in addition to standard tables, guaranteeing a perfectly clean slate.
