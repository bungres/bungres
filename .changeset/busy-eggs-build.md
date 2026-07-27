---
"@bungres/kit": patch
---

- **Fix**: Index diffing now uses deep comparison (properties like `unique`, `using`, `where`) instead of just comparing index names. This ensures modified indexes are correctly dropped and recreated.
- **Fix**: The schema loader now appends a cache-busting timestamp to dynamic imports to prevent Bun/Node from caching stale schema files in watch-mode or programmatic execution.
- **Feature**: Added verbose CLI error diagnostics. When passing `--verbose`, the CLI will now output full stack traces for fatal errors to aid in debugging.
