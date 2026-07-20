import type { SQLChunk } from "../core/sql.js";

export interface ViewConfig {
  name: string;
  query: { toSQL(): SQLChunk };
  materialized?: boolean;
}

export function pgView(name: string, query: { toSQL(): SQLChunk }): ViewConfig {
  return { name, query, materialized: false };
}

export function pgMaterializedView(name: string, query: { toSQL(): SQLChunk }): ViewConfig {
  return { name, query, materialized: true };
}
