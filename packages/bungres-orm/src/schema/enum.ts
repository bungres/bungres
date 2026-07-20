import { buildColumn, type ColBuilder, type ColumnOptions } from "./columns.js";
import type { ForeignKeyRef } from "../types/index.js";

export interface PgEnumConfig<U extends string, TValues extends [U, ...U[]]> {
  enumName: string;
  enumValues: TValues;
}

export function pgEnum<U extends string, TValues extends [U, ...U[]]>(
  enumName: string,
  enumValues: TValues
) {
  const factory = <
    const N extends boolean = false,
    const P extends boolean = false,
    const R extends ForeignKeyRef | undefined = undefined
  >(
    nameOrOpts?: string | ColumnOptions<N, P, R>,
    opts?: ColumnOptions<N, P, R>
  ) => {
    // We treat the enum name as the Postgres dataType for DDL generation
    const col = buildColumn(enumName as any, nameOrOpts as any, opts as any);
    col.enumConfig = { enumName, enumValues };
    
    return col as ColBuilder<"text", N, P, R> & { _enumType: TValues[number]; enumConfig: PgEnumConfig<U, TValues> };
  };

  return Object.assign(factory, { enumName, enumValues });
}
