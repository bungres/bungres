// ---------------------------------------------------------------------------
// sql`` tagged template — builds parameterized SQL fragments safely
// ---------------------------------------------------------------------------

export interface SQLChunk<T = unknown> {
  sql: string;
  params: unknown[];
  _type?: T; // phantom type
}

/**
 * Safely offsets parameter indices (e.g., $1 -> $5) in a SQL string.
 * Ignores $N inside single quotes (') and double quotes (").
 */
export function shiftParams(sql: string, paramsLength: number, offset: number): string {
  if (paramsLength === 0) return sql;
  
  let result = "";
  let inString = false;
  let inIdent = false;
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "'" && !inIdent) {
      inString = !inString;
      result += sql[i];
      i++;
    } else if (sql[i] === '"' && !inString) {
      inIdent = !inIdent;
      result += sql[i];
      i++;
    } else if (!inString && !inIdent && sql[i] === '$') {
      const match = sql.slice(i).match(/^\$(\d+)/);
      if (match) {
        const num = parseInt(match[1]!, 10);
        if (num >= 1 && num <= paramsLength) {
          result += `$${num + offset}`;
          i += match[0].length;
          continue;
        }
      }
      result += sql[i];
      i++;
    } else {
      result += sql[i];
      i++;
    }
  }
  return result;
}

/**
 * Tagged template literal for safe parameterized SQL.
 *
 * Usage:
 *   sql`SELECT * FROM users WHERE id = ${userId}`
 *   // => { sql: 'SELECT * FROM users WHERE id = $1', params: [userId] }
 */
export function sql<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): SQLChunk<T> {
  let query = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    query += strings[i];
    if (i < values.length) {
      const val = values[i];
      // Allow embedding raw SQLChunk fragments (for composing queries)
      if (isSQLChunk(val)) {
        // Shift the param indices of the embedded chunk
        const offset = params.length;
        query += shiftParams(val.sql, val.params.length, offset);
        params.push(...val.params);
      } else {
        params.push(val);
        query += `$${params.length}`;
      }
    }
  }

  return { sql: query, params };
}

export function isSQLChunk(value: unknown): value is SQLChunk<any> {
  return (
    typeof value === "object" &&
    value !== null &&
    "sql" in value &&
    "params" in value &&
    typeof (value as SQLChunk).sql === "string" &&
    Array.isArray((value as SQLChunk).params)
  );
}

/** Combine multiple SQL chunks with a separator */
export function sqlJoin(chunks: SQLChunk<any>[], separator = ", "): SQLChunk<any> {
  const params: unknown[] = [];
  const parts: string[] = [];

  for (const chunk of chunks) {
    const offset = params.length;
    parts.push(shiftParams(chunk.sql, chunk.params.length, offset));
    params.push(...chunk.params);
  }

  return { sql: parts.join(separator), params };
}

/** Raw SQL — no parameterization, use with caution (only for trusted strings) */
export function rawSql<T = unknown>(query: string): SQLChunk<T> {
  return { sql: query, params: [] };
}

/** Format a JavaScript array into a Postgres array literal string: {"elem1","elem2"} */
export function toPgArray(val: unknown[]): string {
  const formatted = val.map((item) => {
    if (item === null || item === undefined) return "NULL";
    if (typeof item === "number" || typeof item === "boolean") return String(item);
    if (Array.isArray(item)) return toPgArray(item);
    const str = String(item).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${str}"`;
  });
  return `{${formatted.join(",")}}`;
}

/** Resolve a column reference to its qualified SQL name */
export function colName(c: string | { name: string; tableName?: string } | SQLChunk): string {
  if (typeof c === "string") return `"${c}"`;
  if (isSQLChunk(c)) return c.sql;
  return c.tableName ? `${c.tableName}."${c.name}"` : `"${c.name}"`;
}
