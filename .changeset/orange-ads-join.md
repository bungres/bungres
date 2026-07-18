---
"@bungres/kit": minor
"@bungres/orm": minor
---

### @bungres/kit

- **Fix workspace dependency resolution during publishing** — now uses `bun changeset publish` instead of custom scripts, ensuring `workspace:*` dependencies are properly resolved to actual versions when packages are published to npm
- **Redesign studio UI with shadcn-style improvements** — compact sidebar, solid backgrounds, proper table headers, and improved pagination controls
- **Add page size selector to studio** — users can now choose 10, 25, 50, or 100 records per page in the data browser
- **Improve studio loading states** — reduced flash effect when changing pagination with smooth transitions
- **Add FK badge support to studio** — foreign key columns now display blue FK badges alongside PK badges
- **Fix studio table layout** — proper header/footer positioning regardless of record count, full-width pagination footer
- Add `ecom` example to changeset ignore list

### @bungres/orm

- **New query operators** — added `notIn` and `between` operators to query conditions for more flexible filtering
- **Export `colName` helper function** — now exported for custom SQL building, allowing users to resolve column references to qualified SQL names
- **Add `noCasing` option** — new `noCasing.table()` factory for table names without automatic case transformation
- **Improve SQL comment handling** — sanitize `*/` sequences in comments to prevent SQL injection issues
- **Add comment support to UPDATE queries** — UPDATE builder now supports SQL comments like SELECT queries
- **Refactor column name resolution** — centralized `colName` function used across conditions, aggregations, and query builders
- **Clean up exports** — improved index file exports for better tree-shaking and smaller bundle sizes
