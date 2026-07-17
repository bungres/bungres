// ---------------------------------------------------------------------------
// sql`` tagged template — builds parameterized SQL fragments safely
// ---------------------------------------------------------------------------

export interface SQLChunk {
  sql: string;
  params: unknown[];
}

/**
 * Tagged template literal for safe parameterized SQL.
 *
 * Usage:
 *   sql`SELECT * FROM users WHERE id = ${userId}`
 *   // => { sql: 'SELECT * FROM users WHERE id = $1', params: [userId] }
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SQLChunk {
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
        query += val.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`);
        params.push(...val.params);
      } else {
        params.push(val);
        query += `$${params.length}`;
      }
    }
  }

  return { sql: query, params };
}

export function isSQLChunk(value: unknown): value is SQLChunk {
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
export function sqlJoin(chunks: SQLChunk[], separator = ", "): SQLChunk {
  const params: unknown[] = [];
  const parts: string[] = [];

  for (const chunk of chunks) {
    const offset = params.length;
    parts.push(chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`));
    params.push(...chunk.params);
  }

  return { sql: parts.join(separator), params };
}

/** Raw SQL — no parameterization, use with caution (only for trusted strings) */
export function rawSql(query: string): SQLChunk {
  return { sql: query, params: [] };
}
