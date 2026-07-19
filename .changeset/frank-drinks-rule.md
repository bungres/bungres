---
"@bungres/kit": minor
---

- **New Command**: Added `bungres rollback` to easily revert the last applied database migration.
- **Studio Overhaul**: Completely modernized the `bungres studio` interface with a beautiful dark UI (Shadcn aesthetic). The data tables are now much smarter, displaying native data types and color-coded constraint badges (PK, FK, UQ, IDX) directly in the headers. Performance has also drastically improved thanks to a lean HTMX + Alpine.js architecture powered natively by Bun's HTML bundler.
