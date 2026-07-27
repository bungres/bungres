import type { SQLChunk } from "../core/sql.js";
import type { ColumnConfig, TableConfig } from "../types/index.js";
import { TableConfigSymbol } from "../utils/constants.js";

export class CTEBuilder<TColumns extends Record<string, ColumnConfig> = Record<string, ColumnConfig>> {
  public readonly alias: string;
  public readonly query: { toSQL(): SQLChunk };
  public [TableConfigSymbol]: TableConfig;

  constructor(alias: string, query: { toSQL(): SQLChunk }) {
    this.alias = alias;
    this.query = query;
    this[TableConfigSymbol] = {
      name: alias,
      columns: {} as TColumns,
    };
  }
}

export function withCte(alias: string, query: { toSQL(): SQLChunk }): CTEBuilder {
  return new CTEBuilder(alias, query);
}
