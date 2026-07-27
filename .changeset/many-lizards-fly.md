---
"@bungres/kit": minor
---

**Studio Improvements**
- Replaced the old raw JSON editor with dynamic UI forms for adding and editing records.
- Added a new Cell Edit Modal for editing individual table cells (perfect for JSON, arrays, and long text).
- Added quick "Expand Row" and "Expand Cell" hover actions directly in the table view.
- Fixed JSON serialization to correctly parse and format JSON/Array database columns without double-escaping.
- Optimized sidebar table counts by batching `COUNT(*)` queries with `Promise.all()`, eliminating N+1 lag.
