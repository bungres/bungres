---
"@bungres/orm": patch
"@bungres/kit": patch
---

- **@bungres/orm**: Fixed PostgreSQL array parameter serialization (`toPgArray`) in `InsertBuilder` and `UpdateBuilder` to properly format array values into valid Postgres array literals (`{"elem1","elem2"}`).
- **@bungres/kit**: Added validation for migration directory and file existence in `migrate`, `status`, `rollback`, `refresh`, and `generate` commands to handle missing folders or files gracefully without throwing raw `ENOENT` errors.
