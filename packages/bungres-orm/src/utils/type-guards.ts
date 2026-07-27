import type { TableConfigImpl } from "../schema/table.js";
import type { ColumnConfig } from "../types/index.js";
import { TableConfigSymbol } from "./constants.js";

/**
 * Type guard to check if a value is a ColumnConfig
 */
export function isColumnConfig(val: unknown): val is ColumnConfig {
  return (
    val !== null &&
    typeof val === "object" &&
    "name" in val &&
    "dataType" in val &&
    typeof (val as ColumnConfig).name === "string" &&
    typeof (val as ColumnConfig).dataType === "string"
  );
}

/**
 * Type guard to check if a value is a TableConfigImpl
 */
export function isTableConfig(val: unknown): val is TableConfigImpl<string, Record<string, ColumnConfig>> {
  return (
    val !== null &&
    typeof val === "object" &&
    "name" in val &&
    "columns" in val &&
    "qualifiedName" in val &&
    typeof (val as TableConfigImpl<string, Record<string, ColumnConfig>>).name === "string" &&
    typeof (val as TableConfigImpl<string, Record<string, ColumnConfig>>).qualifiedName === "string" &&
    typeof (val as TableConfigImpl<string, Record<string, ColumnConfig>>).columns === "object"
  );
}

/**
 * Type guard to check if a value has the TableConfigSymbol
 */
export function hasTableSymbol(val: unknown): val is Record<symbol, TableConfigImpl<string, Record<string, ColumnConfig>>> {
  return (
    val !== null &&
    typeof val === "object" &&
    TableConfigSymbol in val
  );
}

/**
 * Safely get table config from a table object
 * Throws an error if the symbol is not present
 */
export function getTableConfigSafe<TName extends string, TColumns extends Record<string, ColumnConfig<any, any, any, any>>>(
  table: unknown
): TableConfigImpl<TName, TColumns> {
  if (!hasTableSymbol(table)) {
    throw new Error("Invalid table object: missing TableConfigSymbol");
  }
  const config = table[TableConfigSymbol];
  if (!isTableConfig(config)) {
    throw new Error("Invalid table config structure");
  }
  return config as TableConfigImpl<TName, TColumns>;
}
