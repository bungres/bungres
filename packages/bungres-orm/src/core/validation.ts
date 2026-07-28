import { type Table, getTableConfig } from "../schema/table.js";
import type { SchemaConfig } from "../types/relations.js";

export interface ValidationIssue {
  type: "error" | "warning";
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateTable(table: Table<any, any>): ValidationResult {
  const issues: ValidationIssue[] = [];

  try {
    const config = getTableConfig(table);

    if (!config.name || config.name.trim() === "") {
      issues.push({ type: "error", message: "Table name cannot be empty" });
    }

    const columnKeys = Object.keys(config.columns);
    if (columnKeys.length === 0) {
      issues.push({ type: "warning", message: `Table "${config.name}" has no defined columns` });
    }

    let hasPrimaryKey = false;
    for (const key of columnKeys) {
      const col = config.columns[key]!;
      if (!col.name || col.name.trim() === "") {
        issues.push({ type: "error", message: `Column key "${key}" has an empty name`, field: key });
      }
      if (!col.dataType) {
        issues.push({ type: "error", message: `Column "${key}" is missing data type`, field: key });
      }
      if (col.primaryKey) {
        hasPrimaryKey = true;
      }
    }

    if (!hasPrimaryKey) {
      issues.push({ type: "warning", message: `Table "${config.name}" has no primary key defined` });
    }
  } catch (err: any) {
    issues.push({ type: "error", message: `Failed to validate table schema: ${err.message}` });
  }

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
  };
}

export function validateSchema(schema: SchemaConfig): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const [key, item] of Object.entries(schema)) {
    if (item && typeof item === "object" && Symbol.for("BungresTableConfig") in item) {
      const res = validateTable(item as Table<any, any>);
      for (const issue of res.issues) {
        issues.push({
          ...issue,
          message: `[${key}] ${issue.message}`,
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
  };
}
