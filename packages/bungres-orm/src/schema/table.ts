import type { ColumnConfig, ForeignKeyConfig, IndexConfig, InferInsert, InferTable } from "../types/index.js";
import { TableConfigSymbol } from "../utils/constants.js";
import { getTableConfigSafe, hasTableSymbol } from "../utils/type-guards.js";
import type { ConstraintBuilder } from "./indexes.js";

// ---------------------------------------------------------------------------
// TableBuilder — defines a table schema, returns a typed Table object
// ---------------------------------------------------------------------------

// TableConfigSymbol is now imported from ../utils/constants.js

export interface TableConfigImpl<TName extends string, TColumns> {
  name: TName;
  schema?: string;
  columns: TColumns;
  primaryKeys: string[];
  indexes: IndexConfig[];
  foreignKeys: ForeignKeyConfig[];
  checks: string[];
  qualifiedName: string;
}

export function getTableConfig<TName extends string, TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(table: Table<TName, TColumns>): TableConfigImpl<TName, TColumns> {
  return (table as unknown as Record<symbol, TableConfigImpl<TName, TColumns>>)[TableConfigSymbol]!;
}

export function alias<TTable extends Table<any, any>, TAlias extends string>(
  table: TTable,
  aliasName: TAlias
): TTable {
  if (!hasTableSymbol(table)) {
    throw new Error("Invalid table object passed to alias()");
  }
  const cfg = getTableConfigSafe(table);
  const aliasedTable = Object.assign({}, table) as Record<string | symbol, unknown>;

  const newColumns: Record<string, ColumnConfig<any, any, any, any>> = {};
  for (const [key, col] of Object.entries(cfg.columns)) {
    if (!col || typeof col !== "object") {
      throw new Error(`Invalid column config for key: ${key}`);
    }
    const newCol = { ...col, tableName: aliasName };
    newColumns[key] = newCol;
    aliasedTable[key] = newCol;
  }

  const newConfig: TableConfigImpl<TAlias, any> = {
    ...cfg,
    name: aliasName,
    qualifiedName: `"${cfg.name}" AS "${aliasName}"`,
    columns: newColumns,
  };

  aliasedTable[TableConfigSymbol] = newConfig;

  return aliasedTable as unknown as TTable;
}

export type Table<
  TName extends string,
  TColumns extends Record<string, ColumnConfig<any, any, any, any>>
> = TColumns & {
  /** Table name reference for type inference */
  readonly $name?: TName;
  /** Infer standard row type */
  $inferSelect: InferTable<TColumns>;
  /** Infer insert row type */
  $inferInsert: InferInsert<TColumns>;
};

export function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

type ExtraConfig<TColumns> = 
  | {
      schema?: string;
      indexes?: IndexConfig[];
      checks?: string[];
      primaryKeys?: string[];
    }
  | ((cols: TColumns) => ConstraintBuilder[]);

function createTableFactory(casing: "none" | "snake" | "camel") {
  return function <
    TName extends string,
    TColumns extends Record<string, ColumnConfig<any, any, any, any>>
  >(
    name: TName,
    columns: TColumns,
    extra?: ExtraConfig<TColumns>
  ): Table<TName, TColumns> {
    let schema: string | undefined;
    if (extra && typeof extra !== "function") {
      schema = extra.schema;
    }

    const qualifiedName = schema ? `"${schema}"."${name}"` : `"${name}"`;

    const columnConfigs = Object.fromEntries(
      Object.entries(columns).map(([key, config]) => {
        // Use the key as the column name if not explicitly set
        const c = { ...config, tableName: qualifiedName };
        if (!c.name) {
          if (casing === "snake") {
            c.name = camelToSnakeCase(key);
          } else {
            c.name = key;
          }
        }
        return [key, c];
      })
    ) as TColumns;

    const indexes: IndexConfig[] = [];
    const checks: string[] = [];
    const primaryKeys: string[] = [];
    const foreignKeys: ForeignKeyConfig[] = [];

    if (extra) {
      if (typeof extra === "function") {
        const builders = extra(columnConfigs);
        for (const builder of builders) {
          const config = builder.build();
          if (config.type === "index") indexes.push(config as unknown as IndexConfig);
          else if (config.type === "check") checks.push(config.condition as string);
          else if (config.type === "primaryKey") primaryKeys.push(...config.columns as string[]);
          else if (config.type === "foreignKey") foreignKeys.push(config as unknown as ForeignKeyConfig);
        }
      } else {
        if (extra.indexes) indexes.push(...extra.indexes);
        if (extra.checks) checks.push(...extra.checks);
      }
    }

    const tableObj = {
      [TableConfigSymbol]: {
        name,
        ...(schema ? { schema } : {}),
        columns: columnConfigs,
        indexes,
        checks,
        primaryKeys,
        foreignKeys,
        qualifiedName,
      }
    };

    return Object.assign(tableObj, columnConfigs) as unknown as Table<TName, TColumns>;
  };
}

/**
 * Define a table with automatic camelCase → snake_case column mapping (Postgres convention).
 *
 * @example
 * import { pgTable, uuid, varchar } from "@bungres/orm";
 *
 * export const users = pgTable("users", {
 *   id: uuid({ primaryKey: true }),
 *   fullName: varchar({ length: 255 }), // maps to `full_name` automatically
 * });
 */
export const pgTable = createTableFactory("snake");
export const snakeCase = { pgTable: createTableFactory("snake") };
export const camelCase = { pgTable: createTableFactory("camel") };
export const noCasing = { pgTable: createTableFactory("none") };
