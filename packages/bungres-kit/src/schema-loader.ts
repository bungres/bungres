import { resolve, join } from "node:path";
import { TableConfigSymbol, type TableConfig } from "@bungres/orm";

// ---------------------------------------------------------------------------
// Schema loader — imports user schema files and extracts Table definitions
// ---------------------------------------------------------------------------

export interface TableSchemaEntry {
  type: "table";
  exportName: string;
  config: TableConfig;
  table: any;
  filePath: string;
}

export interface EnumSchemaEntry {
  type: "enum";
  exportName: string;
  enumName: string;
  enumValues: string[];
  filePath: string;
}

export interface ViewSchemaEntry {
  type: "view";
  exportName: string;
  config: any; // ViewConfig
  filePath: string;
}

export type SchemaEntry = TableSchemaEntry | EnumSchemaEntry | ViewSchemaEntry;

import { pathToFileURL } from "node:url";

import { existsSync, statSync } from "node:fs";

export async function loadSchemas(
  patterns: string | string[],
  cwd = process.cwd()
): Promise<SchemaEntry[]> {
  const globs = Array.isArray(patterns) ? patterns : [patterns];
  const entries: SchemaEntry[] = [];

  for (const pattern of globs) {
    const filesToLoad: string[] = [];
    const directPath = resolve(cwd, pattern);

    if (existsSync(directPath) && statSync(directPath).isFile()) {
      filesToLoad.push(directPath);
    } else if (existsSync(pattern) && statSync(pattern).isFile()) {
      filesToLoad.push(resolve(pattern));
    } else {
      const glob = new Bun.Glob(pattern);
      for await (const file of glob.scan({ cwd, absolute: true })) {
        filesToLoad.push(file);
      }
    }

    for (const absPath of filesToLoad) {
      const fileUrl = pathToFileURL(absPath).href + "?t=" + Date.now();
      const mod = await import(fileUrl);

      for (const [exportName, value] of Object.entries(mod)) {
        if (isTable(value)) {
          entries.push({
            type: "table",
            exportName,
            config: (value as any)[TableConfigSymbol],
            table: value,
            filePath: absPath,
          });
        } else if (isEnum(value)) {
          entries.push({
            type: "enum",
            exportName,
            enumName: (value as any).enumName,
            enumValues: (value as any).enumValues,
            filePath: absPath,
          });
        } else if (isView(value)) {
          entries.push({
            type: "view",
            exportName,
            config: value,
            filePath: absPath,
          });
        }
      }
    }
  }

  return entries;
}

function isTable(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    TableConfigSymbol in value
  );
}

function isEnum(value: unknown): boolean {
  return (
    typeof value === "function" &&
    "enumName" in value &&
    "enumValues" in value &&
    Array.isArray((value as any).enumValues)
  );
}

function isView(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "query" in value &&
    typeof (value as any).query === "object" &&
    typeof (value as any).query.toSQL === "function"
  );
}
