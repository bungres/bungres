// ---------------------------------------------------------------------------
// Smart SQL Statement Splitter
// Safely splits SQL text into discrete statements without breaking on
// semicolons located inside single quotes, double quotes, dollar quotes ($$),
// or SQL comments (-- and /* */).
// ---------------------------------------------------------------------------

export function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i]!;
    const nextChar = sqlText[i + 1] ?? "";

    // Line comment --
    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote && !inBlockComment && char === "-" && nextChar === "-") {
      inLineComment = true;
    }
    if (inLineComment && (char === "\n" || char === "\r")) {
      inLineComment = false;
    }

    // Block comment /* ... */
    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote && !inLineComment && char === "/" && nextChar === "*") {
      inBlockComment = true;
    }
    if (inBlockComment && char === "*" && nextChar === "/") {
      inBlockComment = false;
      current += "*/";
      i++;
      continue;
    }

    // Dollar quote $$ or $tag$
    if (!inSingleQuote && !inDoubleQuote && !inLineComment && !inBlockComment && char === "$") {
      const match = sqlText.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
      if (match) {
        const tag = match[1]!;
        if (inDollarQuote && dollarTag === tag) {
          inDollarQuote = false;
          dollarTag = "";
          current += tag;
          i += tag.length - 1;
          continue;
        } else if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
          current += tag;
          i += tag.length - 1;
          continue;
        }
      }
    }

    // Single quotes '...' with escaped quote '' handling
    if (!inDoubleQuote && !inDollarQuote && !inLineComment && !inBlockComment && char === "'") {
      if (inSingleQuote && nextChar === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
    }

    // Double quotes "..."
    if (!inSingleQuote && !inDollarQuote && !inLineComment && !inBlockComment && char === '"') {
      inDoubleQuote = !inDoubleQuote;
    }

    // Statement terminator ';' when outside any quotes or comments
    if (char === ";" && !inSingleQuote && !inDoubleQuote && !inDollarQuote && !inLineComment && !inBlockComment) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const finalTrimmed = current.trim();
  if (finalTrimmed) {
    statements.push(finalTrimmed);
  }

  return statements;
}
