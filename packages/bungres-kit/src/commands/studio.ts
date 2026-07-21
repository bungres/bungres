import { bungres, rawSql } from "@bungres/orm";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { ResolvedConfig } from "../config.js";
import { loadSchemas, type TableSchemaEntry } from "../schema-loader.js";

import { renderIndexHtml } from "./template.js";

// ---------------------------------------------------------------------------
// studio — Start a local web interface to browse database data
// ---------------------------------------------------------------------------

export async function runStudio(config: ResolvedConfig): Promise<void> {
  const schemas = (await loadSchemas(config.schema)).filter((s: any) => s.type === "table") as TableSchemaEntry[];

  if (schemas.length === 0) {
    console.warn("No table definitions found in schema files. Connecting anyway to browse DB...");
  }

  const schemaObj: Record<string, any> = {};
  for (const s of schemas) {
    schemaObj[s.exportName] = s.table;
  }

  const db = bungres({ url: config.dbUrl, schema: schemaObj });

  let allSchemas: string[] = ["public"];
  try {
    const res = await db.execute(rawSql(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'`));
    if (Array.isArray(res) && res.length > 0) {
      allSchemas = res.map((r: any) => r.schema_name);
    }
  } catch (e) {
    // fallback if query fails
  }

  const port = Bun.env.PORT ? parseInt(Bun.env.PORT, 10) : 5555;

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // HTMX: Sidebar items
      if (req.method === "GET" && url.pathname === "/htmx/sidebar") {
        const currentSchema = url.searchParams.get("schema") || config.dbSchema || "public";
        let items: { name: string, count: number, type: string }[] = [];
        try {
          const query = `
            SELECT c.relname as name, c.reltuples as count, c.relkind as type 
            FROM pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = '${currentSchema}' 
            AND c.relkind IN ('r', 'v', 'm')
            ORDER BY c.relname
          `;
          const res = await db.execute(rawSql(query));
          if (Array.isArray(res)) {
            items = res as any[];
            for (const item of items) {
              try {
                const countRes = await db.execute(rawSql(`SELECT count(*) as exact_count FROM "${currentSchema}"."${item.name}"`)) as any[];
                if (countRes && countRes.length > 0 && countRes[0]) {
                  item.count = parseInt(String(countRes[0].exact_count), 10);
                }
              } catch (e) {
                // Fallback to estimated count if exact count fails
              }
            }
          }
        } catch(e) {
           items = schemas.map(s => ({ name: s.config.name, count: 0, type: 'r' }));
        }

        const formatCount = (n: number) => {
          if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
          if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
          return Math.floor(n).toString();
        };

        let html = '';
        const groups = [
          { type: 'r', label: 'TABLES' },
          { type: 'm', label: 'MATERIALIZED VIEWS' },
          { type: 'v', label: 'VIEWS' }
        ];

        groups.forEach(group => {
          const groupItems = items.filter(i => i.type === group.type);
          if (groupItems.length === 0) return;

          html += `<div x-data="{ open: true }" class="mb-1">`;
          html += `
            <button @click="open = !open" class="w-full px-3 py-2 text-[10px] font-semibold text-muted hover:text-text tracking-wider flex justify-between items-center transition-colors focus:outline-none">
              <div class="flex items-center gap-1.5">
                <svg class="w-3 h-3 transition-transform" :class="open ? '' : '-rotate-90'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                ${group.label}
              </div>
              <span class="font-mono opacity-60 text-[9px]">${groupItems.length}</span>
            </button>
          `;
          html += '<ul x-show="open" class="flex flex-col gap-0.5 px-2 m-0 list-none">';
          groupItems.forEach(item => {
            let icon = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>'; // table
            if (item.type === 'v') icon = '<svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'; // view
            if (item.type === 'm') icon = '<svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>'; // mview
            
            html += `
              <li x-show="searchQuery === '' || '${item.name}'.toLowerCase().includes(searchQuery.toLowerCase())">
                <button 
                  @click="$dispatch('open-table', { tableName: '${item.name}', tableType: '${item.type}' })"
                  class="w-full text-left px-2 py-1 rounded text-sm font-medium flex items-center justify-between transition-colors focus:outline-none hover:bg-hover hover:text-text group text-muted"
                >
                  <div class="flex items-center gap-2 truncate">
                    ${icon}
                    <span class="truncate">${item.name}</span>
                  </div>
                  <span class="text-[10px] font-mono text-muted/50 group-hover:text-muted">${formatCount(Math.max(0, item.count))}</span>
                </button>
              </li>
            `;
          });
          html += '</ul></div>';
        });

        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }

      // HTMX: Table Data
      if (req.method === "GET" && url.pathname.startsWith("/htmx/tables/")) {
        const tableName = url.pathname.split("/")[3];
        const reqSchema = url.searchParams.get("schema") || config.dbSchema || "public";
        const tabId = url.searchParams.get("tabId") || `table_${tableName}`;
        
        try {
          const page = parseInt(url.searchParams.get("page") || "1", 10);
          const limit = parseInt(url.searchParams.get("limit") || "25", 10);
          const offset = (page - 1) * limit;

          let countResult: any;
          let data: any = [];
          
          const tsSchema = schemas.find(s => s.config.name === tableName);
          let colConfigs: Record<string, any> = {};
          let fkColumns = new Set<string>();

          try {
            if (tsSchema) {
              colConfigs = tsSchema.config.columns || {};
              if (tsSchema.config.foreignKeys) {
                tsSchema.config.foreignKeys.forEach((fk: any) => fk.columns.forEach((col: string) => fkColumns.add(col)));
              }
              const countRes = await db.select({ count: tsSchema.table }).from(tsSchema.table);
              countResult = Array.isArray(countRes) ? [{ count: countRes.length }] : [{ count: 0 }];
              data = await db.select().from(tsSchema.table).limit(limit).offset(offset);
            } else {
              countResult = await db.execute(rawSql(`SELECT COUNT(*) as count FROM "${reqSchema}"."${tableName}"`));
              data = await db.execute(rawSql(`SELECT * FROM "${reqSchema}"."${tableName}" LIMIT ${limit} OFFSET ${offset}`));
              const colQuery = `
                SELECT a.attname as column_name, format_type(a.atttypid, a.atttypmod) as data_type
                FROM pg_attribute a
                JOIN pg_class c ON a.attrelid = c.oid
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE n.nspname = '${reqSchema}' AND c.relname = '${tableName}' AND a.attnum > 0 AND NOT a.attisdropped
              `;
              const colsRes = await db.execute(rawSql(colQuery));
              if (Array.isArray(colsRes)) {
                colsRes.forEach((c: any) => {
                  colConfigs[c.column_name] = { dataType: c.data_type };
                });
              }
            }
          } catch(e) {
            return new Response(`<div class="p-4 text-red-500">Table not found or query error</div>`, { status: 404, headers: { "Content-Type": "text/html" } });
          }

          const total = Array.isArray(countResult) && countResult.length > 0 ? parseInt(countResult[0].count, 10) : 0;
          const totalPages = Math.ceil(total / limit) || 1;
          if (!Array.isArray(data)) data = [];

          const formatValue = (val: any) => {
            if (val === null || val === undefined) return '<span class="italic text-muted/50">NULL</span>';
            if (typeof val === 'object' && !(val instanceof Date)) {
              const rawJson = JSON.stringify(val);
              const b64 = Buffer.from(rawJson).toString('base64');
              const safeJson = rawJson.replace(/&/g, "&amp;").replace(/</g, "&lt;");
              return `<button onclick="window.dispatchEvent(new CustomEvent('open-json-modal', { detail: '${b64}' }))" class="text-text font-mono text-xs hover:underline text-left truncate w-full max-w-[250px] block cursor-pointer" title="Click to view formatted data">${safeJson}</button>`;
            }
            return `<span class="text-text">${String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`;
          };

          const getRawValue = (val: any) => {
             if (val === null || val === undefined) return 'NULL';
             if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
             return String(val);
          };

          const getCopyBtn = (val: any) => {
            const raw = getRawValue(val);
            const b64Val = Buffer.from(raw).toString('base64');
            return `<button onclick="navigator.clipboard.writeText(new TextDecoder().decode(Uint8Array.from(atob('${b64Val}'), c => c.charCodeAt(0)))); const el = this; const orig = el.innerHTML; el.innerHTML = '<svg class=\\'w-3 h-3 text-green-400\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg>'; setTimeout(() => el.innerHTML = orig, 1000);" class="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-panel border border-border shadow-sm rounded text-muted hover:text-text opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center" title="Copy"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;
          };

          const columns = tsSchema ? Object.keys(colConfigs) : Object.keys(data[0] || {});

          let html = '<div class="h-full w-full overflow-auto bg-bg">';
          if (data.length === 0 && columns.length === 0) {
              html += '<div class="p-8 text-center text-muted">Table is Empty</div></div>';
          } else {
              html += '<table class="text-left border-collapse whitespace-nowrap min-w-max">';
              
              html += '<thead><tr>';
              html += `<th class="w-10 px-3 py-2 sticky top-0 z-10 text-center bg-panel"><input type="checkbox" @change="document.querySelectorAll('#data-${tabId} .row-checkbox').forEach(cb => cb.checked = $event.target.checked)" class="w-3.5 h-3.5 rounded border-muted bg-transparent cursor-pointer accent-accent"></th>`;
              columns.forEach(col => {
                const colConfig = colConfigs[col];
                let typeLabel = colConfig ? colConfig.dataType : 'unknown';
                
                let badges = '';
                if (colConfig?.primaryKey) {
                  badges += '<svg class="ml-1.5 w-3 h-3 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Primary Key"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>';
                }
                
                if (fkColumns.has(col) || colConfig?.references) {
                  badges += '<svg class="ml-1.5 w-3 h-3 text-yellow-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="Foreign Key"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
                }

                html += `<th class="px-4 py-2 font-medium sticky top-0 z-10 whitespace-nowrap bg-panel text-muted hover:text-text cursor-pointer transition-colors border-b border-r border-border">
                  <div class="flex items-center gap-2">
                    <span class="flex items-center">${col}${badges}</span>
                    <span class="text-[10px] font-mono opacity-50">${typeLabel}</span>
                  </div>
                </th>`;
              });
              html += '</tr></thead><tbody>';

              data.forEach((row: any) => {
                html += '<tr class="hover:bg-hover transition-colors">';
                html += '<td class="px-3 py-1.5 text-center bg-bg border-b border-r border-border"><input type="checkbox" class="row-checkbox w-3.5 h-3.5 rounded border-muted bg-transparent cursor-pointer accent-accent"></td>';
                columns.forEach((col: string) => {
                  html += `<td class="px-4 py-1.5 max-w-[300px] overflow-hidden text-ellipsis font-mono border-b border-r border-border bg-bg group relative">${formatValue(row[col])}${getCopyBtn(row[col])}</td>`;
                });
                html += '</tr>';
              });

              if (data.length === 0) {
                 html += `<tr><td colspan="${columns.length + 1}" class="px-4 py-16 text-center text-muted bg-bg border-b border-border">
                   <div class="flex flex-col items-center justify-center">
                     <svg class="w-8 h-8 mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                     <span>No records found</span>
                   </div>
                 </td></tr>`;
              }

              html += '</tbody></table></div>';
          }

          const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
          const endRecord = Math.min(page * limit, total);
          
          let paginationHtml = `
            <div id="pagination-${tabId}" hx-swap-oob="true" class="flex items-center gap-4 text-xs text-muted font-mono">
              <span>${startRecord}-${endRecord} of ${total}</span>
              
              <div class="flex items-center gap-3">
                <div class="relative flex items-center border border-border rounded bg-panel overflow-hidden group">
                  <select 
                    class="bg-transparent text-text pl-2 pr-6 py-0.5 focus:outline-none cursor-pointer appearance-none text-center relative z-10 w-full"
                    @change="htmx.ajax('GET', '/htmx/tables/${tableName}?schema=${reqSchema}&tabId=${tabId}&page=1&limit=' + $event.target.value, {target: '#data-${tabId}'})"
                  >
                    <option class="bg-bg text-text" style="background-color: #161618; color: #ededed;" value="10" ${limit === 10 ? 'selected' : ''}>10</option>
                    <option class="bg-bg text-text" style="background-color: #161618; color: #ededed;" value="25" ${limit === 25 ? 'selected' : ''}>25</option>
                    <option class="bg-bg text-text" style="background-color: #161618; color: #ededed;" value="50" ${limit === 50 ? 'selected' : ''}>50</option>
                    <option class="bg-bg text-text" style="background-color: #161618; color: #ededed;" value="100" ${limit === 100 ? 'selected' : ''}>100</option>
                  </select>
                  <div class="absolute right-1 text-muted pointer-events-none z-0 group-hover:text-text transition-colors">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>

                <div class="flex items-center border border-border rounded bg-panel overflow-hidden">
                  <div class="px-2 py-0.5 text-text text-center min-w-[30px]">${page}</div>
                  <div class="px-1 py-0.5 text-muted border-l border-border text-[10px] flex items-center justify-center pointer-events-none bg-panel">
                    of ${totalPages}
                  </div>
                  <button 
                    ${page <= 1 ? 'disabled' : ''}
                    hx-get="/htmx/tables/${tableName}?schema=${reqSchema}&tabId=${tabId}&page=${page - 1}&limit=${limit}"
                    hx-target="#data-${tabId}"
                    class="px-2 py-1 hover:bg-hover hover:text-text disabled:opacity-50 disabled:cursor-not-allowed border-l border-r border-border transition-colors flex items-center justify-center"
                  ><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                  <button 
                    ${page >= totalPages ? 'disabled' : ''}
                    hx-get="/htmx/tables/${tableName}?schema=${reqSchema}&tabId=${tabId}&page=${page + 1}&limit=${limit}"
                    hx-target="#data-${tabId}"
                    class="px-2 py-1 hover:bg-hover hover:text-text disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  ><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                </div>
              </div>
            </div>
          `;

          return new Response(html + paginationHtml, { headers: { "Content-Type": "text/html" } });

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

      // HTMX: Execute Query
      if (req.method === "POST" && url.pathname === "/htmx/query") {
        try {
          const body = await req.formData();
          const query = body.get("query")?.toString() || "";
          
          if (!query.trim()) {
            return new Response('<div class="p-6 text-muted">No query provided.</div>', { headers: { "Content-Type": "text/html" } });
          }

          const startMs = Date.now();
          const res = await db.execute(rawSql(query));
          const duration = Date.now() - startMs;
          
          const data = Array.isArray(res) ? res : [res];

          if (data.length === 0 || (data.length === 1 && typeof data[0] === 'object' && Object.keys(data[0]).length === 0)) {
            return new Response(`<div class="p-4 text-accent text-xs font-mono border-b border-border">Query executed successfully in ${duration}ms. No data returned.</div>`, { headers: { "Content-Type": "text/html" } });
          }

          const columns = Object.keys(data[0] || {});
          
          const formatValue = (val: any) => {
            if (val === null || val === undefined) return '<span class="italic text-muted/50">NULL</span>';
            if (typeof val === 'object' && !(val instanceof Date)) {
              const rawJson = JSON.stringify(val);
              const b64 = Buffer.from(rawJson).toString('base64');
              const safeJson = rawJson.replace(/&/g, "&amp;").replace(/</g, "&lt;");
              return `<button onclick="window.dispatchEvent(new CustomEvent('open-json-modal', { detail: '${b64}' }))" class="text-text font-mono text-xs hover:underline text-left truncate w-full max-w-[250px] block cursor-pointer" title="Click to view formatted data">${safeJson}</button>`;
            }
            return `<span class="text-text">${String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`;
          };

          const getRawValue = (val: any) => {
             if (val === null || val === undefined) return 'NULL';
             if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
             return String(val);
          };

          const getCopyBtn = (val: any) => {
            const raw = getRawValue(val);
            const b64Val = Buffer.from(raw).toString('base64');
            return `<button onclick="navigator.clipboard.writeText(new TextDecoder().decode(Uint8Array.from(atob('${b64Val}'), c => c.charCodeAt(0)))); const el = this; const orig = el.innerHTML; el.innerHTML = '<svg class=\\'w-3 h-3 text-green-400\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg>'; setTimeout(() => el.innerHTML = orig, 1000);" class="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-panel border border-border shadow-sm rounded text-muted hover:text-text opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center" title="Copy"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>`;
          };

          let html = '<div class="h-full w-full overflow-auto bg-bg">';
          html += '<table class="text-left border-collapse whitespace-nowrap min-w-max">';
          
          html += '<thead><tr>';
          columns.forEach(col => {
            const row0 = data.length > 0 ? data[0] : null;
            const typeLabel = row0 && row0[col] != null ? typeof row0[col] : 'unknown';
            html += `<th class="px-4 py-2 font-medium sticky top-0 z-10 whitespace-nowrap bg-panel text-muted hover:text-text cursor-pointer transition-colors border-b border-r border-border">
              <div class="flex items-center gap-2">
                <span class="text-text">${col}</span>
                <span class="text-[10px] font-mono opacity-50">${typeLabel}</span>
              </div>
            </th>`;
          });
          html += '</tr></thead><tbody>';

          data.forEach((row: any) => {
            html += '<tr class="hover:bg-hover transition-colors">';
            columns.forEach((col: string) => {
              html += `<td class="px-4 py-1.5 max-w-[300px] overflow-hidden text-ellipsis font-mono border-b border-r border-border bg-bg group relative">${formatValue(row[col])}${getCopyBtn(row[col])}</td>`;
            });
            html += '</tr>';
          });
          html += '</tbody></table></div>';
          
          html += `<div class="px-4 py-2 text-[10px] text-muted border-t border-border font-mono shrink-0 bg-panel sticky bottom-0">${data.length} row(s) returned in ${duration}ms</div>`;

          return new Response(html, { headers: { "Content-Type": "text/html" } });

        } catch (e: any) {
          return new Response(`
            <div class="p-6">
              <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
                <h3 class="font-semibold mb-1">Query Error</h3>
                <p class="text-sm opacity-80 font-mono break-words whitespace-pre-wrap">${e.message}</p>
              </div>
            </div>
          `, { headers: { "Content-Type": "text/html" } });
        }
      }

      // Frontend: Serve the HTML
      if (req.method === "GET" && url.pathname === "/") {
        const currentSchema = url.searchParams.get("schema") || config.dbSchema || "public";
        return new Response(renderIndexHtml({ schemas: allSchemas, currentSchema }), {
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
