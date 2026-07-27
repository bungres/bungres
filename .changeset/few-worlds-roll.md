---
"@bungres/orm": patch
---

- Improve type safety for Column definitions and operations by removing unsafe type assertions.
- Refactor SQL building for `DeleteBuilder` by caching parameter count, fixing WHERE clause combinations, and implementing strict parameter indexing.
