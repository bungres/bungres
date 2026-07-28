import type { CTEBuilder } from "../builders/cte.js";
import type { TableConfig } from "../types/index.js";

/** Format CTE definitions into a WITH clause and shift parameter placeholders */
export function buildCtePrefix(ctes: CTEBuilder[], params: unknown[]): string {
  if (!ctes || ctes.length === 0) return "";

  const cteStrs: string[] = [];
  for (const cte of ctes) {
    const chunk = cte.query.toSQL();
    const offset = params.length;
    params.push(...chunk.params);
    cteStrs.push(`"${cte.alias}" AS (${chunk.sql.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`)})`);
  }
  return `WITH ${cteStrs.join(", ")} `;
}

/** Format RETURNING clause for table columns */
export function buildReturningClause(
  returning: string[] | undefined,
  tableConfig: TableConfig
): string {
  if (!returning || returning.length === 0) return "";

  const columnsStr =
    returning[0] === "*"
      ? Object.keys(tableConfig.columns)
          .map((c) => `"${tableConfig.columns[c]!.name}" AS "${c}"`)
          .join(", ")
      : returning
          .map((c) => `"${tableConfig.columns[c]?.name ?? c}" AS "${c}"`)
          .join(", ");

  return ` RETURNING ${columnsStr}`;
}

/** Append SQL comment tag if provided */
export function applyComment(query: string, comment?: string): string {
  if (!comment) return query;
  return `${query} /* ${comment.replace(/\*\//g, "")} */`;
}
