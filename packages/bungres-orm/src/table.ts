import type { ColumnConfig, IndexConfig, InferInsert, InferTable } from "./types.js";

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

function createTableFactory(casing: "none" | "snake" | "camel") {
  return function <
    TName extends string,
    TColumns extends Record<string, ColumnConfig<any, any, any, any>>
  >(
    name: TName,
    columns: TColumns,
    extra?: {
      schema?: string;
      indexes?: IndexConfig[];
      checks?: string[];
      primaryKeys?: string[];
    }
  ): Table<TName, TColumns> {
    const columnConfigs = Object.fromEntries(
      Object.entries(columns).map(([key, config]) => {
        // Use the key as the column name if not explicitly set
        const c = { ...config };
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

    const schema = extra?.schema;
    const qualifiedName = schema ? `"${schema}"."${name}"` : `"${name}"`;

    const tableObj = {
      [TableConfigSymbol]: {
        name,
        schema,
        columns: columnConfigs,
        indexes: extra?.indexes ?? [],
        checks: extra?.checks ?? [],
        primaryKeys: extra?.primaryKeys ?? [],
        qualifiedName,
      }
    };

    return Object.assign(tableObj, columnConfigs) as any;
  };
}

export const table = createTableFactory("none");
export const snakeCase = { table: createTableFactory("snake") };
export const camelCase = { table: createTableFactory("camel") };
