import { createDB } from "@bungres/orm";
import type { ResolvedConfig } from "../config.js";
import { loadSchemas, type SchemaEntry } from "../schema-loader.js";
import * as path from "node:path";
import { colorize } from "../utils/colors.js";

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

  const db = createDB({ url: config.dbUrl, schema: schemaObj });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5555;

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // API: List tables
      if (req.method === "GET" && url.pathname === "/api/tables") {
        const tables = schemas.map(s => ({
          name: s.config.name,
          exportName: s.exportName,
          columns: Object.entries(s.config.columns).map(([key, col]) => ({
            name: col.name,
            type: col.dataType,
            primaryKey: col.primaryKey
          }))
        }));
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
          // Fetch max 100 rows for the studio view
          const data = await db.select().from(schema.table).limit(100);
          return new Response(JSON.stringify(data), {
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

      // Frontend: Serve the HTML
      if (req.method === "GET" && url.pathname === "/") {
        return new Response(htmlTemplate, {
          headers: { "Content-Type": "text/html" }
        });
      }

      return new Response("Not found", { status: 404 });
    }
  });

  console.log(colorize("=========================================", "cyan"));
  console.log(colorize(`🐘 Bungres Studio is running!`, "cyan"));
  console.log(colorize(`   Local: http://localhost:${server.port}`, "green"));
  console.log(colorize("=========================================", "cyan"));
}

const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bungres Studio</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0d1117;
      --panel-bg: #161b22;
      --border-color: #30363d;
      --text-main: #c9d1d9;
      --text-muted: #8b949e;
      --accent-color: #58a6ff;
      --accent-hover: #1f6feb;
      --header-bg: #161b22;
      --row-hover: #1f2428;
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: 250px;
      background-color: var(--panel-bg);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sidebar-header h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: white;
    }

    .table-list {
      flex: 1;
      overflow-y: auto;
      padding: 10px 0;
      list-style: none;
      margin: 0;
    }

    .table-item {
      padding: 8px 20px;
      cursor: pointer;
      font-size: 14px;
      color: var(--text-muted);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .table-item:hover {
      background-color: var(--row-hover);
      color: var(--text-main);
    }

    .table-item.active {
      background-color: rgba(88, 166, 255, 0.1);
      color: var(--accent-color);
      border-right: 3px solid var(--accent-color);
    }

    /* Main Content */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: var(--bg-color);
    }

    .main-header {
      height: 60px;
      padding: 0 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: var(--header-bg);
    }

    .main-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      color: white;
    }

    .btn {
      background-color: var(--accent-color);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn:hover {
      background-color: var(--accent-hover);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .content-area {
      flex: 1;
      overflow: auto;
      padding: 20px;
    }

    /* Data Table */
    .data-grid-container {
      background-color: var(--panel-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    th {
      background-color: rgba(255,255,255,0.02);
      color: var(--text-muted);
      font-weight: 500;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    td {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-main);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background-color: var(--row-hover);
    }

    .type-number { color: #79c0ff; }
    .type-string { color: #a5d6ff; }
    .type-boolean { color: #ff7b72; }
    .type-date { color: #d2a8ff; }
    .type-null { color: var(--text-muted); font-style: italic; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-muted);
    }
  </style>
</head>
<body>

  <div class="sidebar">
    <div class="sidebar-header">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
      </svg>
      <h1>Bungres Studio</h1>
    </div>
    <ul class="table-list" id="table-list">
      <!-- Populated by JS -->
    </ul>
  </div>

  <div class="main">
    <div class="main-header">
      <h2 id="current-table-name">Select a table</h2>
      <button id="refresh-btn" class="btn" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Refresh Data
      </button>
    </div>
    <div class="content-area">
      <div id="data-container" class="empty-state">
        <p>Select a table from the sidebar to view data</p>
      </div>
    </div>
  </div>

  <script>
    let currentTable = null;
    let tablesData = [];

    // Format values for the data grid
    function formatValue(val) {
      if (val === null || val === undefined) return '<span class="type-null">null</span>';
      if (typeof val === 'number') return \`<span class="type-number">\${val}</span>\`;
      if (typeof val === 'boolean') return \`<span class="type-boolean">\${val}</span>\`;
      if (val instanceof Date || (typeof val === 'string' && val.match(/^\\d{4}-\\d{2}-\\d{2}T/))) {
        return \`<span class="type-date">\${new Date(val).toLocaleString()}</span>\`;
      }
      // Escape HTML to prevent XSS
      const safeStr = String(val)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return \`<span class="type-string">\${safeStr}</span>\`;
    }

    async function loadTables() {
      try {
        const res = await fetch('/api/tables');
        tablesData = await res.json();
        
        const list = document.getElementById('table-list');
        list.innerHTML = '';
        
        tablesData.forEach(t => {
          const li = document.createElement('li');
          li.className = 'table-item';
          li.innerHTML = \`
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            \${t.name}
          \`;
          li.onclick = () => selectTable(t.name);
          list.appendChild(li);
        });
      } catch (e) {
        console.error("Failed to load tables", e);
      }
    }

    async function selectTable(name) {
      currentTable = name;
      
      // Update UI active state
      document.querySelectorAll('.table-item').forEach(el => {
        if (el.textContent.trim() === name) el.classList.add('active');
        else el.classList.remove('active');
      });
      
      document.getElementById('current-table-name').textContent = name;
      document.getElementById('refresh-btn').disabled = false;
      
      const container = document.getElementById('data-container');
      container.innerHTML = '<div class="empty-state">Loading data...</div>';
      container.className = '';
      
      try {
        const res = await fetch(\`/api/tables/\${name}/data\`);
        if (!res.ok) throw new Error(await res.text());
        const rows = await res.json();
        
        if (rows.length === 0) {
          container.innerHTML = '<div class="empty-state">No data in this table</div>';
          return;
        }

        const columns = Object.keys(rows[0]);
        
        let html = '<div class="data-grid-container"><table><thead><tr>';
        columns.forEach(col => {
          html += \`<th>\${col}</th>\`;
        });
        html += '</tr></thead><tbody>';
        
        rows.forEach(row => {
          html += '<tr>';
          columns.forEach(col => {
            html += \`<td>\${formatValue(row[col])}</td>\`;
          });
          html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
        
      } catch (e) {
        container.innerHTML = \`<div class="empty-state" style="color: #ff7b72;">Error: \${e.message}</div>\`;
      }
    }

    document.getElementById('refresh-btn').addEventListener('click', async () => {
      if (!currentTable) return;
      
      const btn = document.getElementById('refresh-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Refreshing...';
      
      try {
        await selectTable(currentTable);
      } catch (e) {
        console.error("Failed to refresh data", e);
      } finally {
        setTimeout(() => { btn.innerHTML = originalText; }, 300);
      }
    });

    // Init
    loadTables();
  </script>
</body>
</html>
`;
