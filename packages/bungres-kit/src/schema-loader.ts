import { resolve, join } from "node:path";
import { TableConfigSymbol, type TableConfig } from "@bungres/orm";

// ---------------------------------------------------------------------------
// Schema loader — imports user schema files and extracts Table definitions
// ---------------------------------------------------------------------------

export interface SchemaEntry {
  exportName: string;
  config: TableConfig;
  table: any;
  filePath: string;
}

export async function loadSchemas(
  patterns: string | string[],
  cwd = process.cwd()
): Promise<SchemaEntry[]> {
  const globs = Array.isArray(patterns) ? patterns : [patterns];
  const entries: SchemaEntry[] = [];

  for (const pattern of globs) {
    const glob = new Bun.Glob(pattern);
    for await (const file of glob.scan({ cwd, absolute: false })) {
      const absPath = resolve(join(cwd, file));
      const mod = await import(absPath);

      for (const [exportName, value] of Object.entries(mod)) {
        if (isTable(value)) {
          entries.push({
            exportName,
            config: (value as any)[TableConfigSymbol],
            table: value,
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
