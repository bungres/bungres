import type { ColumnConfig } from "../types/index.js";
import type { SQLChunk } from "../core/sql.js";
import type { Table, TableConfigImpl } from "./table.js";

export abstract class ConstraintBuilder {
  abstract build(): any;
}

export class IndexBuilder extends ConstraintBuilder {
  private _columns: ColumnConfig[] = [];
  private _using?: "btree" | "hash" | "gin" | "gist" | "brin";
  private _where?: string;

  constructor(public readonly name?: string, public readonly isUnique: boolean = false) {
    super();
  }

  on(...columns: ColumnConfig[]): this {
    this._columns = columns;
    return this;
  }

  using(method: "btree" | "hash" | "gin" | "gist" | "brin"): this {
    this._using = method;
    return this;
  }

  where(condition: string): this {
    this._where = condition;
    return this;
  }

  build() {
    return {
      type: "index",
      name: this.name,
      columns: this._columns.map(c => c.name),
      unique: this.isUnique,
      using: this._using,
      where: this._where,
    };
  }
}

export class CheckConstraintBuilder extends ConstraintBuilder {
  constructor(public readonly condition: SQLChunk, public readonly name?: string) {
    super();
  }

  build() {
    const constraintName = this.name ? `CONSTRAINT "${this.name}" ` : "";
    return {
      type: "check",
      name: this.name,
      condition: `${constraintName}CHECK (${this.condition.sql})`
    };
  }
}

export class PrimaryKeyBuilder extends ConstraintBuilder {
  private _columns: ColumnConfig[] = [];
  
  constructor(public readonly name?: string) {
    super();
  }

  on(...columns: ColumnConfig[]): this {
    this._columns = columns;
    return this;
  }

  build() {
    return {
      type: "primaryKey",
      name: this.name,
      columns: this._columns.map(c => c.name)
    };
  }
}

export class ForeignKeyBuilder extends ConstraintBuilder {
  private _columns: ColumnConfig[] = [];
  private _foreignTable?: Table<any, any>;
  private _foreignColumns: ColumnConfig[] = [];
  private _onDelete?: "cascade" | "set null" | "set default" | "restrict" | "no action";
  private _onUpdate?: "cascade" | "set null" | "set default" | "restrict" | "no action";

  constructor(public readonly name?: string) {
    super();
  }

  on(...columns: ColumnConfig[]): this {
    this._columns = columns;
    return this;
  }

  references(table: Table<any, any>, ...columns: ColumnConfig[]): this {
    this._foreignTable = table;
    this._foreignColumns = columns;
    return this;
  }

  onDelete(action: "cascade" | "set null" | "set default" | "restrict" | "no action"): this {
    this._onDelete = action;
    return this;
  }

  onUpdate(action: "cascade" | "set null" | "set default" | "restrict" | "no action"): this {
    this._onUpdate = action;
    return this;
  }

  build() {
    const TableConfigSymbol = Symbol.for("BungresTableConfig");
    const foreignTableName = this._foreignTable ? ((this._foreignTable as any)[TableConfigSymbol] as TableConfigImpl<any, any>).name : "";
    return {
      type: "foreignKey",
      name: this.name,
      columns: this._columns.map(c => c.name),
      foreignTable: foreignTableName,
      foreignColumns: this._foreignColumns.map(c => c.name),
      onDelete: this._onDelete,
      onUpdate: this._onUpdate
    };
  }
}

export const index = (name?: string) => new IndexBuilder(name, false);
export const unique = (name?: string) => new IndexBuilder(name, true);
export const check = (condition: SQLChunk, name?: string) => new CheckConstraintBuilder(condition, name);
export const primaryKey = (name?: string) => new PrimaryKeyBuilder(name);
export const foreignKey = (name?: string) => new ForeignKeyBuilder(name);
