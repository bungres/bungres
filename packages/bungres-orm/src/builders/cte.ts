import type { SQLChunk } from "../core/sql.js";
import { TableConfigSymbol } from "../schema/table.js";
import type { TableConfig } from "../types/index.js";

export class CTEBuilder<TColumns extends Record<string, any> = any> {
  public readonly alias: string;
  public readonly query: { toSQL(): SQLChunk };
  public [TableConfigSymbol]: TableConfig;

  constructor(alias: string, query: { toSQL(): SQLChunk }) {
    this.alias = alias;
    this.query = query;
    this[TableConfigSymbol] = {
      name: alias,
      columns: {} as any,
    };
  }
}

export function withCte(alias: string, query: { toSQL(): SQLChunk }): CTEBuilder {
  return new CTEBuilder(alias, query);
}
