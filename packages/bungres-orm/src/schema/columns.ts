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
): ColumnConfig<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef> & { as: (alias: string) => any } {
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
    as(this: any, alias: string) {
      return Object.assign({}, this, { alias });
    }
  }) as unknown as ColumnConfig<T, ActualNotNull<TNotNull, TPrimary>, TPrimary, TRef> & { as: (alias: string) => any };
}

export type ColBuilder<
  T extends ColumnDataType,
  N extends boolean,
  P extends boolean,
  R extends ForeignKeyRef | undefined
> = ColumnConfig<T, ActualNotNull<N, P>, P, R> & { as: (alias: string) => any };

// ---------------------------------------------------------------------------
// Typed Column Helpers
// ---------------------------------------------------------------------------

export const text = <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<"text", N, P, R> => buildColumn("text", nameOrOpts, opts) as any;

export const varchar = <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | (ColumnOptions<N, P, R> & { length?: number }), opts?: ColumnOptions<N, P, R> & { length?: number }): ColBuilder<"varchar", N, P, R> => {
  const c = buildColumn("varchar", nameOrOpts as any, opts as any);
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  if (options?.length !== undefined) (c as any).length = options.length;
  return c as any;
};

export const char = <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | (ColumnOptions<N, P, R> & { length?: number }), opts?: ColumnOptions<N, P, R> & { length?: number }): ColBuilder<"char", N, P, R> => {
  const c = buildColumn("char", nameOrOpts as any, opts as any);
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  if (options?.length !== undefined) (c as any).length = options.length;
  return c as any;
};

const col = <T extends ColumnDataType>(dataType: T) =>
  <const N extends boolean = false, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<T, N, P, R> => buildColumn(dataType, nameOrOpts, opts) as any;

export const integer = col("integer");
export const bigint = col("bigint");
export const smallint = col("smallint");

export const serial = <const N extends boolean = true, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<"serial", true, P, R> => {
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  return buildColumn("serial", typeof nameOrOpts === "string" ? nameOrOpts : { ...options, notNull: true as any }, { ...options, notNull: true as any }) as any;
};

export const bigserial = <const N extends boolean = true, const P extends boolean = false, const R extends ForeignKeyRef | undefined = undefined>(nameOrOpts?: string | ColumnOptions<N, P, R>, opts?: ColumnOptions<N, P, R>): ColBuilder<"bigserial", true, P, R> => {
  let options = typeof nameOrOpts === "string" ? opts : nameOrOpts;
  return buildColumn("bigserial", typeof nameOrOpts === "string" ? nameOrOpts : { ...options, notNull: true as any }, { ...options, notNull: true as any }) as any;
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
