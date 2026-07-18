import type { ColumnConfig, IndexConfig, InferInsert, InferTable, ForeignKeyConfig } from "../types/index.js";
import type { ConstraintBuilder } from "./indexes.js";

// ---------------------------------------------------------------------------
// TableBuilder — defines a table schema, returns a typed Table object
// ---------------------------------------------------------------------------

export const TableConfigSymbol = Symbol.for("BungresTableConfig");

export interface TableConfigImpl<TName extends string, TColumns> {
  name: TName;
  schema: string | undefined;
  columns: TColumns;
  primaryKeys: string[];
  indexes: IndexConfig[];
  foreignKeys: ForeignKeyConfig[];
  checks: string[];
  qualifiedName: string;
}

export function getTableConfig(table: Table<any, any>): TableConfigImpl<any, any> {
  return (table as any)[TableConfigSymbol];
}

export type Table<
  TName extends string,
  TColumns extends Record<string, ColumnConfig<any, any, any, any>>
> = TColumns & {
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
          if (config.type === "index") indexes.push(config);
          else if (config.type === "check") checks.push(config.condition);
          else if (config.type === "primaryKey") primaryKeys.push(...config.columns);
          else if (config.type === "foreignKey") foreignKeys.push(config);
        }
      } else {
        if (extra.indexes) indexes.push(...extra.indexes);
        if (extra.checks) checks.push(...extra.checks);
      }
    }

    const tableObj = {
      [TableConfigSymbol]: {
        name,
        schema,
        columns: columnConfigs,
        indexes,
        checks,
        primaryKeys,
        foreignKeys,
        qualifiedName,
      }
    };

    return Object.assign(tableObj, columnConfigs) as any;
  };
}

/**
 * Define a table with automatic camelCase → snake_case column mapping (Postgres convention).
 *
 * @example
 * import { table, uuid, varchar } from "@bungres/orm";
 *
 * export const users = table("users", {
 *   id: uuid({ primaryKey: true }),
 *   fullName: varchar({ length: 255 }), // maps to `full_name` automatically
 * });
 */
export const table = createTableFactory("snake");
export const snakeCase = { table: createTableFactory("snake") };
export const camelCase = { table: createTableFactory("camel") };
export const noCasing = { table: createTableFactory("none") };
