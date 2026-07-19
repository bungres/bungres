import { bungres } from "@bungres/orm";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";

import { indexHtml } from "./template.js";

// ---------------------------------------------------------------------------
// studio — Start a local web interface to browse database data
// ---------------------------------------------------------------------------

export async function runStudio(config: ResolvedConfig): Promise<void> {
  const schemas = await loadSchemas(config.schema);

  if (schemas.length === 0) {
    console.warn("No table definitions found in schema files.");
    return;
  }

  const schemaObj: Record<string, any> = {};
  for (const s of schemas) {
    schemaObj[s.exportName] = s.table;
  }

  const db = bungres({ url: config.dbUrl, schema: schemaObj });

  const port = Bun.env.PORT ? parseInt(Bun.env.PORT, 10) : 5555;

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // API: List tables
      if (req.method === "GET" && url.pathname === "/api/tables") {
        const tables = schemas.map(s => {
          // Build a set of FK columns from table-level foreignKeys
          const fkColumns = new Set();
          if (s.config.foreignKeys) {
            s.config.foreignKeys.forEach(fk => {
              fk.columns.forEach(col => fkColumns.add(col));
            });
          }

          const columns = Object.entries(s.config.columns).map(([key, col]) => {
            const fk = col.references ? {
              table: col.references.table,
              column: col.references.column
            } : (fkColumns.has(col.name) ? { isForeignKey: true } : null);

            return {
              name: col.name,
              type: col.dataType,
              primaryKey: col.primaryKey,
              foreignKey: fk
            };
          });

          return {
            name: s.config.name,
            exportName: s.exportName,
            columns,
            foreignKeys: s.config.foreignKeys || []
          };
        });
        return new Response(JSON.stringify(tables), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // API: Get table data
      if (req.method === "GET" && url.pathname.startsWith("/api/tables/") && url.pathname.endsWith("/data")) {
        const tableName = url.pathname.split("/")[3];
        const schema = schemas.find(s => s.config.name === tableName);

        if (!schema) {
          return new Response("Table not found", { status: 404 });
        }

        try {
          const page = parseInt(url.searchParams.get("page") || "1", 10);
          const limit = parseInt(url.searchParams.get("limit") || "50", 10);
          const offset = (page - 1) * limit;

          // Fetch total count
          const countResult = await db.select({ count: schema.table }).from(schema.table);
          const total = Array.isArray(countResult) ? countResult.length : 0;

          // Fetch paginated data
          const data = await db.select().from(schema.table).limit(limit).offset(offset);

          return new Response(JSON.stringify({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // API: Open in editor
      if (req.method === "POST" && url.pathname === "/api/editor/open") {
        try {
          const body = (await req.json()) as { tableName: string };
          const tableName = body.tableName;
          const schema = schemas.find(s => s.config.name === tableName);

          if (schema && schema.filePath) {
            console.log(`Attempting to open ${schema.filePath} in editor...`);
            // Attempt 1: Bun native (relies on $EDITOR or `code` in PATH)
            Bun.openInEditor(schema.filePath, { editor: "vscode" });

            return new Response(JSON.stringify({
              success: true,
              filePath: schema.filePath
            }), {
              headers: { "Content-Type": "application/json" }
            });
          }
          return new Response("Schema not found", { status: 404 });
        } catch (e) {
          return new Response("Invalid request", { status: 400 });
        }
      }

      // HTMX: Sidebar items
      if (req.method === "GET" && url.pathname === "/htmx/sidebar") {
        let html = '<ul class="flex flex-col gap-0.5 p-2 m-0 list-none">';
        schemas.forEach(s => {
          const tableName = s.config.name;
          html += `
            <li>
              <button 
                hx-get="/htmx/tables/${tableName}?page=1&limit=25"
                hx-target="#data-container"
                @click="currentTable = '${tableName}'; pageSize = 25"
                :class="currentTable === '${tableName}' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'"
                class="w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors focus:outline-none"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                ${tableName}
              </button>
            </li>
          `;
        });
        html += '</ul>';
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }

      // HTMX: Table Data
      if (req.method === "GET" && url.pathname.startsWith("/htmx/tables/")) {
        const tableName = url.pathname.split("/")[3];
        const schema = schemas.find(s => s.config.name === tableName);

        if (!schema) {
          return new Response(`<div class="p-4 text-red-500">Table not found</div>`, { status: 404, headers: { "Content-Type": "text/html" } });
        }

        try {
          const page = parseInt(url.searchParams.get("page") || "1", 10);
          const limit = parseInt(url.searchParams.get("limit") || "25", 10);
          const offset = (page - 1) * limit;

          const countResult = await db.select({ count: schema.table }).from(schema.table);
          const total = Array.isArray(countResult) ? countResult.length : 0;
          const totalPages = Math.ceil(total / limit) || 1;

          const data = await db.select().from(schema.table).limit(limit).offset(offset);

          const formatValue = (val: any) => {
            if (val === null || val === undefined) return '<span class="italic text-muted-foreground">null</span>';
            if (typeof val === 'number') return `<span class="text-foreground">${val}</span>`;
            if (typeof val === 'boolean') return `<span class="text-foreground">${val}</span>`;
            if (val instanceof Date) return `<span class="text-foreground">${val.toISOString()}</span>`;
            if (typeof val === 'object') return `<span class="text-foreground font-mono text-xs">${JSON.stringify(val).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`;
            return `<span class="text-foreground">${String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`;
          };

          if (data.length === 0) {
            return new Response(`
              <div class="flex flex-col items-center justify-center h-full w-full text-muted-foreground animate-[fadeIn_0.5s_ease-out]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-16 h-16 mb-4 text-muted">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 class="text-foreground m-0 mb-2 text-lg">Table is Empty</h3>
                <p class="text-sm">No records found in "${tableName}"</p>
              </div>
            `, { headers: { "Content-Type": "text/html" } });
          }

          const columns = Object.keys(data[0] || {});

          let html = '<div class="flex flex-col h-full w-full bg-background">';
          html += '<div class="flex-1 overflow-auto">';
          html += '<table class="text-left border-collapse text-sm whitespace-nowrap">';

          // Header
          html += '<thead><tr>';
          columns.forEach(col => {
            const colConfig = schema.config.columns ? schema.config.columns[col] : null;
            let typeLabel = colConfig ? colConfig.dataType : 'unknown';
            let indexLabel = '';

            if (colConfig?.primaryKey) {
              indexLabel += '<span class="ml-1 text-[10px] bg-emerald-500/20 text-emerald-500 px-1 rounded uppercase" title="Primary Key">PK</span>';
            }
            if (colConfig?.unique) {
              indexLabel += '<span class="ml-1 text-[10px] bg-amber-500/20 text-amber-500 px-1 rounded uppercase" title="Unique">UQ</span>';
            }
            if (colConfig?.references) {
              indexLabel += '<span class="ml-1 text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded uppercase" title="Foreign Key">FK</span>';
            }

            if (schema.config.indexes) {
              const isIndexed = schema.config.indexes.some(idx => idx.columns.includes(col));
              if (isIndexed) {
                indexLabel += '<span class="ml-1 text-[10px] bg-blue-500/20 text-blue-500 px-1 rounded uppercase" title="Indexed">IDX</span>';
              }
            }

            html += `<th class="bg-card border-b border-r border-border px-4 py-2.5 font-medium text-muted-foreground sticky top-0 z-10">
              <div class="flex flex-col gap-0.5">
                <span class="text-foreground">${col}</span>
                <div class="flex items-center flex-wrap gap-1 mt-0.5">
                  <span class="text-[10px] font-mono text-muted-foreground/70 mr-1">${typeLabel}</span>
                  ${indexLabel}
                </div>
              </div>
            </th>`;
          });
          html += '</tr></thead><tbody>';

          // Body
          data.forEach(row => {
            html += '<tr class="hover:bg-muted/50 transition-colors">';
            columns.forEach(col => {
              html += `<td class="border-b border-r border-border px-4 py-2 max-w-[300px] overflow-hidden text-ellipsis">${formatValue(row[col])}</td>`;
            });
            html += '</tr>';
          });
          html += '</tbody></table></div>';

          // Pagination
          const startRecord = (page - 1) * limit + 1;
          const endRecord = Math.min(page * limit, total);

          html += `
            <div class="flex items-center justify-between px-4 py-3 bg-card border-t border-border text-xs text-muted-foreground shrink-0 sticky bottom-0 z-10 w-full">
              <div class="flex items-center gap-4">
                <span>${total} records</span>
                <span>${startRecord}-${endRecord}</span>
              </div>
              <div class="flex items-center gap-2">
                <select 
                  name="limit" 
                  class="bg-background border border-border text-foreground px-2 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  @change="pageSize = $event.target.value; htmx.ajax('GET', '/htmx/tables/${tableName}?page=1&limit=' + pageSize, {target: '#data-container'})"
                >
                  <option value="10" ${limit === 10 ? 'selected' : ''}>10</option>
                  <option value="25" ${limit === 25 ? 'selected' : ''}>25</option>
                  <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
                  <option value="100" ${limit === 100 ? 'selected' : ''}>100</option>
                </select>
                
                <button 
                  ${page <= 1 ? 'disabled' : ''}
                  hx-get="/htmx/tables/${tableName}?page=${page - 1}&limit=${limit}"
                  hx-target="#data-container"
                  class="bg-background border border-border text-foreground px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >&larr;</button>
                
                <span class="min-w-[40px] text-center">${page} / ${totalPages}</span>
                
                <button 
                  ${page >= totalPages ? 'disabled' : ''}
                  hx-get="/htmx/tables/${tableName}?page=${page + 1}&limit=${limit}"
                  hx-target="#data-container"
                  class="bg-background border border-border text-foreground px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >&rarr;</button>
              </div>
            </div>
          `;

          html += '</div>';

          return new Response(html, { headers: { "Content-Type": "text/html" } });

        } catch (e: any) {
          return new Response(`
            <div class="p-6">
              <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
                <h3 class="font-semibold mb-1">Error Loading Data</h3>
                <p class="text-sm opacity-80">${e.message}</p>
              </div>
            </div>
          `, { headers: { "Content-Type": "text/html" } });
        }
      }

      // Frontend: Serve the HTML
      if (req.method === "GET" && url.pathname === "/") {
        return new Response(indexHtml, {
          headers: { "Content-Type": "text/html" }
        });
      }

      return new Response("Not found", { status: 404 });
    }
  });

  p.intro(pc.bgCyan(pc.black(" 🐘 Bungres Studio ")));
  p.log.success(`Studio is running at ${pc.green(`http://localhost:${server.port}`)}`);
  p.outro(pc.gray("Press Ctrl+C to stop"));
}
