import type { ColumnConfig, TableConfig } from "@bungres/orm";
import { generateCreateTable, generateAddColumn, generateDropColumn, generateAddConstraint, generateDropConstraint } from "@bungres/orm";

// ---------------------------------------------------------------------------
// Schema differ — compares two schema snapshots and emits SQL statements
// that migrate from `prev` to `next`
// ---------------------------------------------------------------------------

/** Snapshot stored on disk after each generate */
export type SchemaSnapshot = Record<string, TableConfig>;

export interface DiffResult {
  statements: string[];
  summary: string[];
  warnings: string[];
}

export function diffSchemas(
  prev: SchemaSnapshot,
  next: SchemaSnapshot
): DiffResult {
  const statements: string[] = [];
  const summary: string[] = [];
  const warnings: string[] = [];

  const prevTables = new Set(Object.keys(prev));
  const nextTables = new Set(Object.keys(next));

  // ── New tables — topo-sorted so FK deps come first ────────────────────────
  const newTableConfigs: TableConfig[] = [];
  for (const tableName of nextTables) {
    if (!prevTables.has(tableName)) {
      newTableConfigs.push(next[tableName]!);
    }
  }

  for (const config of topoSortConfigs(newTableConfigs)) {
    statements.push(generateCreateTable(config, true));
    summary.push(`CREATE TABLE ${config.name}`);
  }

  // ── Dropped tables ────────────────────────────────────────────────────────
  for (const tableName of prevTables) {
    if (!nextTables.has(tableName)) {
      const config = prev[tableName]!;
      const tbl = config.schema
        ? `"${config.schema}"."${tableName}"`
        : `"${tableName}"`;
      statements.push(`DROP TABLE IF EXISTS ${tbl};`);
      summary.push(`DROP TABLE ${tableName}`);
      warnings.push(`Data loss warning: Table '${tableName}' will be permanently deleted.`);
    }
  }

  // ── Modified tables — column-level diff ───────────────────────────────────
  for (const tableName of nextTables) {
    if (!prevTables.has(tableName)) continue; // already handled above

    const prevConfig = prev[tableName]!;
    const nextConfig = next[tableName]!;
    const prevCols = prevConfig.columns;
    const nextCols = nextConfig.columns;
    const prevColNames = new Set(Object.keys(prevCols));
    const nextColNames = new Set(Object.keys(nextCols));

    // Added columns
    for (const key of nextColNames) {
      if (!prevColNames.has(key)) {
        const col = nextCols[key]!;
        statements.push(generateAddColumn(tableName, nextConfig.schema, key, col));
        summary.push(`ALTER TABLE ${tableName} ADD COLUMN ${col.name}`);
      }
    }

    // Dropped columns
    for (const key of prevColNames) {
      if (!nextColNames.has(key)) {
        const col = prevCols[key]!;
        statements.push(generateDropColumn(tableName, prevConfig.schema, col.name));
        summary.push(`ALTER TABLE ${tableName} DROP COLUMN ${col.name}`);
        warnings.push(`Data loss warning: Column '${col.name}' in table '${tableName}' will be permanently deleted.`);
      }
    }

    // Changed columns
    for (const key of nextColNames) {
      if (!prevColNames.has(key)) continue;
      const changes = diffColumn(prevCols[key]!, nextCols[key]!);
      if (changes.length > 0) {
        const tbl = nextConfig.schema
          ? `"${nextConfig.schema}"."${tableName}"`
          : `"${tableName}"`;
        for (const change of changes) {
          statements.push(`ALTER TABLE ${tbl} ${change};`);
          summary.push(`ALTER TABLE ${tableName} ALTER COLUMN ${nextCols[key]!.name} (${change})`);
        }
      }

      // Foreign Key diffing
      const prevRef = prevCols[key]!.references;
      const nextRef = nextCols[key]!.references;
      if (JSON.stringify(prevRef) !== JSON.stringify(nextRef)) {
        const constraintName = `${tableName}_${nextCols[key]!.name}_fkey`;
        if (prevRef) {
          statements.push(generateDropConstraint(tableName, nextConfig.schema, constraintName));
          summary.push(`ALTER TABLE ${tableName} DROP CONSTRAINT ${constraintName}`);
        }
        if (nextRef) {
          let fkDef = `FOREIGN KEY ("${nextCols[key]!.name}") REFERENCES "${nextRef.table}"("${nextRef.column}")`;
          if (nextRef.onDelete) fkDef += ` ON DELETE ${nextRef.onDelete.toUpperCase()}`;
          if (nextRef.onUpdate) fkDef += ` ON UPDATE ${nextRef.onUpdate.toUpperCase()}`;
          statements.push(generateAddConstraint(tableName, nextConfig.schema, constraintName, fkDef));
          summary.push(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName}`);
        }
      }
    }

    // New indexes
    const prevIdxNames = new Set(
      (prevConfig.indexes ?? []).map(
        (i) => i.name ?? `idx_${tableName}_${i.columns.join("_")}`
      )
    );
    for (const idx of nextConfig.indexes ?? []) {
      const idxName = idx.name ?? `idx_${tableName}_${idx.columns.join("_")}`;
      if (!prevIdxNames.has(idxName)) {
        const tbl = nextConfig.schema
          ? `"${nextConfig.schema}"."${tableName}"`
          : `"${tableName}"`;
        const unique = idx.unique ? "UNIQUE " : "";
        const using = idx.using ? ` USING ${idx.using.toUpperCase()}` : "";
        const cols = idx.columns.map((c) => `"${c}"`).join(", ");
        const where = idx.where ? ` WHERE ${idx.where}` : "";
        statements.push(
          `CREATE ${unique}INDEX IF NOT EXISTS "${idxName}" ON ${tbl}${using} (${cols})${where};`
        );
        summary.push(`CREATE INDEX ${idxName} ON ${tableName}`);
      }
    }

    // Dropped indexes
    const nextIdxNames = new Set(
      (nextConfig.indexes ?? []).map(
        (i) => i.name ?? `idx_${tableName}_${i.columns.join("_")}`
      )
    );
    for (const idx of prevConfig.indexes ?? []) {
      const idxName = idx.name ?? `idx_${tableName}_${idx.columns.join("_")}`;
      if (!nextIdxNames.has(idxName)) {
        statements.push(`DROP INDEX IF EXISTS "${idxName}";`);
        summary.push(`DROP INDEX ${idxName}`);
      }
    }
  }

  return { statements, summary, warnings };
}

// ---------------------------------------------------------------------------
// Topological sort for TableConfig objects
// ---------------------------------------------------------------------------

export function topoSortConfigs(tables: TableConfig[]): TableConfig[] {
  const byName = new Map<string, TableConfig>(tables.map((t) => [t.name, t]));
  const visited = new Set<string>();
  const result: TableConfig[] = [];

  function deps(config: TableConfig): string[] {
    return Object.values(config.columns)
      .map((col) => col.references?.table)
      .filter((t): t is string => t !== undefined && byName.has(t) && t !== config.name);
  }

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);
    const config = byName.get(name);
    if (!config) return;
    for (const dep of deps(config)) visit(dep);
    result.push(config);
  }

  for (const table of tables) visit(table.name);
  return result;
}

// ---------------------------------------------------------------------------
// Column-level diff
// ---------------------------------------------------------------------------

function diffColumn(prev: ColumnConfig, next: ColumnConfig): string[] {
  const changes: string[] = [];
  const col = `"${next.name}"`;

  if (prev.dataType !== next.dataType) {
    changes.push(
      `ALTER COLUMN ${col} TYPE ${next.dataType.toUpperCase()} USING ${col}::${next.dataType}`
    );
  } else {
    // Check for length changes on varchar/char (length lives as an extra property)
    const prevLen = (prev as any).length;
    const nextLen = (next as any).length;
    if (prevLen !== nextLen && (next.dataType === "varchar" || next.dataType === "char")) {
      const typeName = next.dataType === "varchar" ? "VARCHAR" : "CHAR";
      const typeStr = nextLen ? `${typeName}(${nextLen})` : typeName;
      changes.push(`ALTER COLUMN ${col} TYPE ${typeStr}`);
    }
  }

  if (!prev.notNull && next.notNull) {
    changes.push(`ALTER COLUMN ${col} SET NOT NULL`);
  }
  if (prev.notNull && !next.notNull) {
    changes.push(`ALTER COLUMN ${col} DROP NOT NULL`);
  }

  const prevDef =
    prev.defaultFn ??
    (prev.defaultValue !== undefined ? String(prev.defaultValue) : undefined);
  const nextDef =
    next.defaultFn ??
    (next.defaultValue !== undefined ? String(next.defaultValue) : undefined);

  if (prevDef !== nextDef) {
    if (nextDef !== undefined) {
      const val = next.defaultFn ?? formatDefault(next.defaultValue, next.dataType);
      changes.push(`ALTER COLUMN ${col} SET DEFAULT ${val}`);
    } else {
      changes.push(`ALTER COLUMN ${col} DROP DEFAULT`);
    }
  }

  return changes;
}

function formatDefault(value: unknown, dataType: ColumnConfig["dataType"]): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (dataType === "boolean") return value;
    return `'${value.replace(/'/g, "''")}'`;
  }
  return `'${JSON.stringify(value)}'`;
}
