---
"@bungres/kit": minor
---

- **Studio View & Materialized View Fix**: Added dynamic primary key detection (`getPrimaryKeyColumn`) and safe order clause construction to prevent `column t.id does not exist` query errors on views and materialized views lacking an `id` column.
- **Type-Aware Data Filtering**: Refactored SQL filter conditions to use type-aware comparisons (`::numeric`, `::timestamptz`, `::boolean`) instead of string-only comparison, ensuring accurate numeric and date filtering. Added `>=` (`gte`) and `<=` (`lte`) filter operators.
- **Context-Aware CSV & JSON Export**: Added `/htmx/tables/:tableName/export` endpoints for downloading CSV and JSON table exports that preserve active search queries, column filters, sorting order, or selected row checkboxes.
- **1-Click Column Header Sorting**: Interactive 1-click column header sorting with active direction indicators (`↑` / `↓`).
- **Reset & Clear Toolbar Controls**: Added a main toolbar **Reset** button and in-popover **Clear** buttons to reset active filters and sorts in one click.
- **UI & Contrast Polish**: Improved button contrast across primary action buttons, unified pagination and refresh control heights (`h-7`), aligned header checkbox layout with row checkboxes, and fixed dev-mode static asset resolution.
