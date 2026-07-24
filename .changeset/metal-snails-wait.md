---
"@bungres/kit": major
---
# 🚀 Major Release (Breaking Changes)

This release introduces a significant overhaul of Bungres' migration engine, seeding system, CLI, Studio, and public API. It includes a new migration architecture, improved PostgreSQL compatibility, better CI/CD workflows, and numerous developer experience improvements.

> **⚠️ Breaking Changes**
>
> * **New Migration Format:** Migrations are no longer generated as flat `.sql` files with a shared `meta/` directory. Every migration now lives inside its own timestamped folder containing:
>
>   * `up.sql`
>   * `down.sql`
>   * `snapshot.json`
>
>   Existing projects must regenerate or migrate to the new folder structure before upgrading.

## ✨ Highlights

### 🗂️ New 3-File Migration Architecture (Breaking)

Migration generation has been completely redesigned.

Each migration is now created inside its own timestamped directory containing:

* `up.sql` — executable UP migration
* `down.sql` — executable rollback migration
* `snapshot.json` — schema snapshot used for future diffs

This architecture makes migrations easier to inspect, review, roll back, and version while eliminating the previous centralized metadata directory.

---

### ✅ New `bungres check`

Added a new non-destructive verification command for CI/CD pipelines.

`bungres check` validates that:

* database schema matches the current schema definition
* no pending migrations exist

Exit codes:

* `0` → Database is in sync
* `1` → Schema drift or pending migrations detected

Perfect for GitHub Actions and deployment pipelines.

---

### 🧠 Smart SQL Lexer

Introduced a production-grade SQL statement splitter (`splitSqlStatements`).

Unlike simple semicolon splitting, it safely handles:

* quoted strings
* JSON values
* array literals
* PostgreSQL dollar-quoted functions (`$$`)
* SQL comments
* escaped characters

preventing invalid SQL parsing during migration execution.

---

### 🔒 Idempotent DDL Execution

Migration execution is now significantly more resilient.

DDL statements including:

* `CREATE TABLE`
* `CREATE TYPE`
* `CREATE INDEX`
* `CREATE MATERIALIZED VIEW`

are automatically wrapped inside PostgreSQL `SAVEPOINT`s.

Duplicate object errors (`42710`, `42P07`, `42712`) are automatically rolled back to the savepoint and execution continues without aborting the entire transaction.

---

### 🎯 Enum Migration Support

Schema diffing now detects enum expansion.

Bungres automatically generates:

```sql
ALTER TYPE "enum_name"
ADD VALUE IF NOT EXISTS 'value';
```

making enum evolution fully supported without manual SQL.

---

### 🌱 Completely Upgraded Seeding Engine

The seeding system received a major upgrade with improved PostgreSQL awareness and smarter data generation.

New capabilities include:

* PostgreSQL enum support
* array literal generation
* self-referencing foreign keys
* junction table composite key deduplication
* semantic fake generators

  * emails
  * slugs
  * SKUs
  * URLs
* varchar length enforcement
* improved migration/status reporting

---

### 🚀 New Fluent Seeder API

Introduced an entirely new high-performance seeding framework.

```ts
defineSeed(seed => {
  seed
    .table(users)
    .count(1000)
    .columns({
      email: seed.fake.email(),
      role: seed.fake.values(...)
    });
});
```

Features include:

* fluent blueprint API
* chainable table definitions
* weighted value distributions
* automatic dependency graph ordering
* bulk vectorized inserts
* relation helpers
* composite key deduplication

Designed for generating millions of records efficiently.

---

### ⚡ Improved CLI Experience

CLI usability has been significantly improved.

New flags:

* `-y`, `--yes`
* `-v`, `--verbose`
* `-c`, `--config`
* `-f`, `--force`
* `-h`, `--help`

Additionally:

* automatic CI environment detection
* non-interactive execution
* confirmation prompts skipped in automation

---

### 🎨 Bungres Studio Improvements

Studio received one of its largest updates.

New features include:

* toolbar state machine
* Filter mode
* Sort mode
* Add Record
* Edit Record
* multi-row Delete
* right slide-over editor
* JSON-based create/update forms
* row loading API
* URL hash tab persistence
* animated refresh controls
* JSON/JSONB formatting
* object and array rendering
* column filtering
* sorting
* improved record management workflow

---

### 📦 Expanded Public API

The main `@bungres/kit` entrypoint now exports many additional utilities including:

* migration helpers
* schema diffing
* database introspection
* rollback utilities
* refresh/fresh commands
* Studio launcher
* Seeder engine
* SQL parser
* snapshot loader
* migration loaders

making Bungres easier to integrate into custom tooling.

---

### 🧪 Expanded Test Coverage

Added **22 new unit tests** covering:

* schema differ
* SQL lexer
* migration discovery
* migration generation
* CLI flag parsing
* CI validation
* seeding engine
* blueprint execution

providing significantly stronger regression protection.
