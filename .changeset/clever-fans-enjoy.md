---
"@bungres/orm": minor
---

Comprehensive ORM improvements and new feature additions:

- **Error Class Hierarchy & Error Handling**: Added `BungresError`, `QueryError`, `ConnectionError`, `ValidationError`, and `TransactionError` classes. Added connection string validation and `queryTimeout` configuration.
- **Connection Pool Monitoring**: Added `db.getPoolStatus()` returning pool capacity and active/idle query metrics.
- **Batch Operations**: Added `bulkInsert()`, `bulkUpdate()`, and `bulkDelete()` methods across query builders for high-performance batching.
- **Pagination Helpers**: Added `.paginate(page, pageSize)` and `.cursorPaginate(cursor, limit)` methods to `SelectBuilder`.
- **Query Debugging & Transactions**: Added `logQueries` and `logQueryTiming` DB options, `getLastQuery()`, and transaction isolation level control (`isolation`).
- **Schema Validation**: Added `validateTable()` and `validateSchema()` utilities for runtime schema assertions.
- **Soft Delete & Query Helpers**: Added `deletedAt()` column helper, `.softDelete()` on `DeleteBuilder`, string/date conditions (`startsWith`, `endsWith`, `contains`, `betweenDate`), and window/aggregation functions (`stddev`, `variance`, `rowNumber`, `rank`, `denseRank`).
- **Code Deduplication**: Refactored SQL builder formatting utilities (`buildCtePrefix`, `buildReturningClause`, `applyComment`) and unified `BaseQueryExecutor` for client and transaction query factory methods.
