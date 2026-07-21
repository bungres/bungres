---
"@bungres/kit": patch
---

- Fixed an issue where CLI commands (`drop`, `status`, `migrate`, `push`, `refresh`, `rollback`, `seed`) would hang (orphaned spinners) when a database connection failed.
- Added `--config` flag to CLI to allow specifying a custom config file path.
- Improved Tusky REPL to log generated SQL queries and display results using JSON stringify.
- Improved Studio data grid with loading skeletons and JSON syntax highlighting.
