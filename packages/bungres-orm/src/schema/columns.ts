import type { ColumnConfig, ColumnDataType, ForeignKeyRef } from "../types/index.js";

// ---------------------------------------------------------------------------
// Column Factory — modern object-based API, no chained builders
// ---------------------------------------------------------------------------

export interface ColumnOptions<
  TNotNull extends boolean = false,
  TPrimary extends boolean = false,
  TRef extends ForeignKeyRef | undefined = undefined
> {
  notNull?: TNotNull;
  primaryKey?: TPrimary;
  unique?: boolean;
  default?: unknown;
  defaultRaw?: string;
  references?: TRef;
  check?: string;
}

type ActualNotNull<N extends boolean, P extends boolean> = P extends true ? true : N;

export function buildColumn<
  T extends ColumnDataType,
  TNotNull extends boolean = false,
  TPrimary extends boolean = false,
  TRef extends ForeignKeyRef | undefined = undefined
>(
  dataType: T,
  nameOrOpts?: string | ColumnOptions<TNotNull, TPrimary, TRef>,
  opts?: ColumnOptions<TNotNull, TPrimary, TRef>
): ColBuilder<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef> {
  let name = "";
  let options = opts;
  if (typeof nameOrOpts === "string") {
    name = nameOrOpts;
  } else if (nameOrOpts !== undefined) {
    options = nameOrOpts as ColumnOptions<TNotNull, TPrimary, TRef>;
  }
  const isPrimary = options?.primaryKey ?? false;
  // If it's a primary key, it's implicitly not null
  const isNotNull = isPrimary || (options?.notNull ?? false);

  let defaultFn = options?.defaultRaw;
  // Auto-default UUID primary keys
  if (isPrimary && dataType === "uuid" && !defaultFn) {
    defaultFn = "gen_random_uuid()";
  }

  const config = {
    name,
    dataType,
    notNull: isNotNull as unknown as ActualNotNull<TNotNull, TPrimary>,
    primaryKey: isPrimary as unknown as TPrimary,
    unique: options?.unique ?? false,
    defaultValue: options?.default,
    ...(defaultFn !== undefined ? { defaultFn } : {}),
    ...(options?.references !== undefined ? { references: options.references } : {}),
    ...(options?.check !== undefined ? { check: options.check } : {}),
  } as ColumnConfig<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef>;

  return Object.assign(config, {
    as<TAlias extends string>(this: ColBuilder<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef>, alias: TAlias) {
      return Object.assign({}, this, { alias }) as ColBuilder<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef> & { alias: TAlias };
    },
    array(this: ColBuilder<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef>) {
      return Object.assign({}, this, { dataType: `${this.dataType}[]` }) as unknown as ColBuilder<`${T}[]`, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef>;
    },
    generatedAlwaysAs(this: ColBuilder<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef>, expr: string | { sql: string }) {
      const sqlStr = typeof expr === "string" ? expr : expr.sql;
      return Object.assign({}, this, { generatedAs: sqlStr }) as ColBuilder<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef>;
    }
  }) as unknown as ColBuilder<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef>;
}

export type ColBuilder<
  T extends ColumnDataType,
  N extends boolean,
  P extends boolean,
  R extends ForeignKeyRef | undefined
> = ColumnConfig<T, ActualNotNull<N, P>, P, R> & { 
  as: <TAlias extends string>(alias: TAlias) => ColBuilder<T, N, P, R> & { alias: TAlias };
  array: () => ColBuilder<`${T}[]`, N, P, R>;
  generatedAlwaysAs: (expr: string | { sql: string }) => ColBuilder<T, N, P, R>;
};

// ---------------------------------------------------------------------------
// Typed Column Helpers
// ---------------------------------------------------------------------------

export const text = <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<"text", N, P, R> => buildColumn("text", nameOrOpts, opts) as unknown as ColBuilder<"text", N, P, R>;

export const varchar = <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | (ColumnOptions<N, P, R> & { length?: number }), opts?: ColumnOptions<N, P, R> & { length?: number }): ColBuilder<"varchar", N, P, R> => {
  const c = buildColumn("varchar", nameOrOpts as unknown as ColumnOptions<N, P, R>, opts as unknown as ColumnOptions<N, P, R>) as unknown as ColBuilder<"varchar", N, P, R>;
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  if (options?.length !== undefined) (c as unknown as { length?: number }).length = options.length;
  return c;
};

export const char = <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | (ColumnOptions<N, P, R> & { length?: number }), opts?: ColumnOptions<N, P, R> & { length?: number }): ColBuilder<"char", N, P, R> => {
  const c = buildColumn("char", nameOrOpts as unknown as ColumnOptions<N, P, R>, opts as unknown as ColumnOptions<N, P, R>) as unknown as ColBuilder<"char", N, P, R>;
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  if (options?.length !== undefined) (c as unknown as { length?: number }).length = options.length;
  return c;
};

const col = <T extends ColumnDataType>(dataType: T) =>
  <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<T, N, P, R> => buildColumn(dataType, nameOrOpts, opts) as unknown as ColBuilder<T, N, P, R>;

export const integer = col("integer");
export const bigint = col("bigint");
export const smallint = col("smallint");

export const serial = <const N extends boolean = true, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<"serial", true, P, R> => {
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  return buildColumn("serial", typeof nameOrOpts === "string" ? nameOrOpts : { ...options, notNull: true } as unknown as ColumnOptions<N, P, R>, { ...options, notNull: true } as unknown as ColumnOptions<N, P, R>) as unknown as ColBuilder<"serial", true, P, R>;
};

export const bigserial = <const N extends boolean = true, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<"bigserial", true, P, R> => {
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  return buildColumn("bigserial", typeof nameOrOpts === "string" ? nameOrOpts : { ...options, notNull: true } as unknown as ColumnOptions<N, P, R>, { ...options, notNull: true } as unknown as ColumnOptions<N, P, R>) as unknown as ColBuilder<"bigserial", true, P, R>;
};

export const smallserial = <const N extends boolean = true, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<"smallserial", true, P, R> => {
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  return buildColumn("smallserial", typeof nameOrOpts === "string" ? nameOrOpts : { ...options, notNull: true } as unknown as ColumnOptions<N, P, R>, { ...options, notNull: true } as unknown as ColumnOptions<N, P, R>) as unknown as ColBuilder<"smallserial", true, P, R>;
};

export const boolean = col("boolean");
export const real = col("real");
export const doublePrecision = col("double precision");
export const numeric = col("numeric");
export const decimal = col("decimal");
export const json = col("json");
export const jsonb = col("jsonb");
export const timestamp = col("timestamp");
export const timestamptz = col("timestamptz");
export const date = col("date");
export const time = col("time");
export const timetz = col("timetz");
export const uuid = col("uuid");
export const bytea = col("bytea");
export const interval = col("interval");
export const inet = col("inet");
export const cidr = col("cidr");
export const macaddr = col("macaddr");
export const textArray = col("text[]");
export const integerArray = col("integer[]");
export const varcharArray = col("varchar[]");
export const uuidArray = col("uuid[]");

export function customType<TData>(dataType: string) {
  return <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(
    nameOrOpts?: string | ColumnOptions<N, P, R>,
    opts?: ColumnOptions<N, P, R>
  ): ColBuilder<any, N, P, R> => buildColumn(dataType as ColumnDataType, nameOrOpts, opts) as unknown as ColBuilder<any, N, P, R>;
}
