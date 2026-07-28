---
"@bungres/kit": patch
"@bungres/orm": patch
---

- **Build**: Removed `--sourcemap=external` flag from `bun build` to eliminate bloated external JS sourcemap files from published dist outputs.
- **Build**: Added clean build step (`rm -rf ./dist`) before building.
- **Engines**: Removed `node` from `engines` specification in `package.json` to accurately reflect Bun native requirement (`bun >=1.3.0`).
- **CLI & Docs**: Updated `tusky` REPL description to clarify interactive database REPL.
- **Kit**: Fixed `schema-loader.ts` to support loading direct file paths in addition to glob patterns.
- **Kit**: Updated database name validation regex in `ensure-db.ts` to support hyphens (`-`) matching ORM validation rules.
- **Studio**: Default table queries to `ORDER BY primaryKey ASC` so updated rows remain fixed in place instead of jumping to the end of the table due to PostgreSQL MVCC heap behavior. Preserved pagination and sort order across record updates.