import { createDB } from "@bungres/orm";
import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";
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
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #09090b;
      --panel-bg: rgba(24, 24, 27, 0.7);
      --border-color: #27272a;
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
      --accent-color: #8b5cf6;
      --accent-hover: #7c3aed;
      --header-bg: rgba(9, 9, 11, 0.85);
      --row-hover: rgba(39, 39, 42, 0.8);
      --glass-border: rgba(255, 255, 255, 0.08);
      
      --type-number: #f472b6;
      --type-string: #60a5fa;
      --type-boolean: #34d399;
      --type-date: #c084fc;
      --type-json: #fbbf24;
      --type-null: #71717a;
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: 280px;
      background-color: var(--panel-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      box-shadow: 4px 0 24px rgba(0,0,0,0.2);
      z-index: 20;
    }

    .sidebar-header {
      padding: 24px;
      border-bottom: 1px solid var(--glass-border);
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(to bottom, rgba(255,255,255,0.03), transparent);
    }

    .sidebar-header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      background: linear-gradient(to right, #fff, #a1a1aa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .sidebar-header svg {
      color: var(--accent-color);
      filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.5));
    }

    .table-list {
      flex: 1;
      overflow-y: auto;
      padding: 16px 12px;
      list-style: none;
      margin: 0;
    }

    .table-list::-webkit-scrollbar {
      width: 6px;
    }
    .table-list::-webkit-scrollbar-thumb {
      background: #3f3f46;
      border-radius: 4px;
    }

    .table-item {
      padding: 12px 16px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      color: var(--text-muted);
      border-radius: 8px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
      border: 1px solid transparent;
    }

    .table-item:hover {
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
      transform: translateX(4px);
    }

    .table-item.active {
      background-color: rgba(139, 92, 246, 0.15);
      color: #fff;
      border: 1px solid rgba(139, 92, 246, 0.3);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.1);
    }

    .table-item svg {
      transition: transform 0.3s ease;
    }
    .table-item.active svg {
      color: var(--accent-color);
      transform: scale(1.1);
    }

    /* Main Content */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .main-header {
      height: 70px;
      padding: 0 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: var(--header-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 10;
    }

    .main-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: white;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      background-color: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      font-family: 'Outfit', sans-serif;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .btn:active:not(:disabled) {
      transform: translateY(1px);
    }

    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .content-area {
      flex: 1;
      overflow: auto;
      padding: 0;
      position: relative;
      z-index: 1;
      text-align: left;
    }

    /* Data Table */
    .data-grid-container {
      background-color: rgba(24, 24, 27, 0.5);
      border: 1px solid var(--border-color);
      border-radius: 0;
      overflow: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      backdrop-filter: blur(8px);
      max-height: 100%;
      width: 100%;
    }
    
    .data-grid-container::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .data-grid-container::-webkit-scrollbar-corner {
      background: transparent;
    }
    .data-grid-container::-webkit-scrollbar-thumb {
      background: #3f3f46;
      border-radius: 4px;
    }

    table {
      width: auto;
      border-collapse: separate;
      border-spacing: 0;
      text-align: left;
      font-size: 14px;
      table-layout: auto;
    }

    th {
      background-color: rgba(24, 24, 27, 0.95);
      backdrop-filter: blur(4px);
      color: var(--text-main);
      font-weight: 500;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
      white-space: nowrap;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    
    th::after {
      content: '';
      position: absolute;
      bottom: -1px; left: 0; right: 0;
      height: 1px;
      background: var(--border-color);
    }

    .col-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .col-name {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pk-badge {
      font-size: 10px;
      background: rgba(251, 191, 36, 0.2);
      color: #fbbf24;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    
    .col-type {
      font-size: 12px;
      color: var(--text-muted);
      font-family: monospace;
    }

    td {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
      color: var(--text-main);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: background-color 0.2s ease;
    }
    

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background-color: var(--row-hover);
    }

    .type-number { color: var(--type-number); }
    .type-string { color: var(--type-string); }
    .type-boolean { color: var(--type-boolean); }
    .type-date { color: var(--type-date); }
    .type-json { color: var(--type-json); font-family: monospace; }
    .type-null { color: var(--type-null); font-style: italic; }
    
    .cell-value {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
      color: var(--text-muted);
      animation: fadeIn 0.5s ease-out;
    }
    
    .empty-state svg {
      margin-bottom: 16px;
      color: #3f3f46;
      width: 64px;
      height: 64px;
    }
    
    .empty-state h3 {
      color: var(--text-main);
      margin: 0 0 8px 0;
      font-size: 18px;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .spinning {
      animation: spin 1s linear infinite;
    }

    /* Pagination */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background-color: rgba(24, 24, 27, 0.95);
      border-top: 1px solid var(--border-color);
      font-size: 14px;
      color: var(--text-muted);
      position: sticky;
      bottom: 0;
      z-index: 5;
    }

    .pagination-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pagination-btn {
      background-color: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s ease;
    }

    .pagination-btn:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .pagination-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .pagination-btn.active {
      background-color: var(--accent-color);
      border-color: var(--accent-color);
    }

    .page-input {
      background-color: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 6px 8px;
      border-radius: 6px;
      width: 50px;
      text-align: center;
      font-size: 13px;
    }
  </style>
</head>
<body>

  <div class="sidebar">
    <div class="sidebar-header">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      <h2 id="current-table-name">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        Select a table
      </h2>
      <button id="refresh-btn" class="btn" disabled>
        <svg id="refresh-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Refresh
      </button>
    </div>
    <div class="content-area">
      <div id="data-container" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <h3>No Table Selected</h3>
        <p>Choose a table from the sidebar to view its data</p>
      </div>
    </div>
  </div>

  <script>
    let currentTable = null;
    let tablesData = [];
    let tableSchemas = {};
    let currentPage = 1;
    let totalPages = 1;
    let totalRecords = 0;
    let pageSize = 50;

    // Format values for the data grid
    function formatValue(val) {
      if (val === null || val === undefined) return 'null';
      
      if (typeof val === 'object') {
        if (val instanceof Date) {
          return val.toISOString();
        }
        // Handle JSON objects
        const safeJson = JSON.stringify(val)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return safeJson;
      }
      
      if (typeof val === 'string') {
        // Escape HTML to prevent XSS
        const safeStr = String(val)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return safeStr;
      }
      
      return String(val);
    }

    async function loadTables() {
      try {
        const res = await fetch('/api/tables');
        tablesData = await res.json();
        
        const list = document.getElementById('table-list');
        list.innerHTML = '';
        tableSchemas = {};
        
        tablesData.forEach(t => {
          tableSchemas[t.name] = t;
          const li = document.createElement('li');
          li.className = 'table-item';
          li.innerHTML = \`
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

    async function selectTable(name, page = 1) {
      currentTable = name;
      currentPage = page;
      
      // Update UI active state
      document.querySelectorAll('.table-item').forEach(el => {
        if (el.textContent.trim() === name) el.classList.add('active');
        else el.classList.remove('active');
      });
      
      document.getElementById('current-table-name').innerHTML = \`
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-color);">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
        \${name}
      \`;
      document.getElementById('refresh-btn').disabled = false;
      
      const container = document.getElementById('data-container');
      container.innerHTML = \`
        <div class="empty-state">
          <svg class="spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <p>Loading data...</p>
        </div>
      \`;
      
      try {
        const res = await fetch(\`/api/tables/\${name}/data?page=\${page}&limit=\${pageSize}\`);
        if (!res.ok) throw new Error(await res.text());
        const response = await res.json();
        
        const rows = response.data || response;
        totalRecords = response.total || 0;
        totalPages = response.totalPages || 1;
        
        const tableSchema = tableSchemas[name];
        
        if (rows.length === 0) {
          container.innerHTML = \`
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3>Table is Empty</h3>
              <p>No records found in "\${name}"</p>
            </div>
          \`;
          return;
        }

        // Use all columns from the actual data to ensure foreign keys and all data are shown
        let columns = [];
        const allKeys = new Set();
        rows.forEach(row => {
          Object.keys(row).forEach(key => allKeys.add(key));
        });
        
        // Try to get type info from schema if available
        const schemaColMap = {};
        if (tableSchema && tableSchema.columns && tableSchema.columns.length > 0) {
          tableSchema.columns.forEach(col => {
            schemaColMap[col.name] = col;
          });
        }
        
        columns = Array.from(allKeys).map(key => ({
          name: key,
          type: schemaColMap[key] ? schemaColMap[key].type : typeof rows[0][key],
          primaryKey: schemaColMap[key] ? schemaColMap[key].primaryKey : false
        }));
        
        let html = '<div class="data-grid-container"><table><thead><tr>';
        columns.forEach(col => {
          html += \`
            <th>
              <div class="col-header">
                <div class="col-name">
                  \${col.name}
                  \${col.primaryKey ? '<span class="pk-badge">PK</span>' : ''}
                </div>
                <div class="col-type">\${col.type}</div>
              </div>
            </th>
          \`;
        });
        html += '</tr></thead><tbody>';
        
        rows.forEach(row => {
          html += '<tr>';
          columns.forEach(col => {
            html += \`<td>\${formatValue(row[col.name])}</td>\`;
          });
          html += '</tr>';
        });
        
        html += '</tbody></table>';
        
        // Add pagination
        html += renderPagination();
        
        html += '</div>';
        container.innerHTML = html;
        
      } catch (e) {
        container.innerHTML = \`
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3 style="color: #ef4444;">Error Loading Data</h3>
            <p>\${e.message}</p>
          </div>
        \`;
      }
    }

    function renderPagination() {
      const startRecord = (currentPage - 1) * pageSize + 1;
      const endRecord = Math.min(currentPage * pageSize, totalRecords);
      
      let html = '<div class="pagination">';
      html += '<div class="pagination-info">';
      html += \`<span>Total: \${totalRecords} records</span>\`;
      html += \`<span>Page \${currentPage} of \${totalPages}</span>\`;
      html += \`<span>Showing \${startRecord}-\${endRecord}</span>\`;
      html += '</div>';
      
      html += '<div class="pagination-controls">';
      
      // Previous button
      html += \`<button class="pagination-btn" onclick="changePage(\${currentPage - 1})" \${currentPage === 1 ? 'disabled' : ''}>Previous</button>\`;
      
      // Next button
      html += \`<button class="pagination-btn" onclick="changePage(\${currentPage + 1})" \${currentPage === totalPages ? 'disabled' : ''}>Next</button>\`;
      
      html += '</div>';
      html += '</div>';
      
      return html;
    }

    function changePage(page) {
      if (page < 1 || page > totalPages) return;
      selectTable(currentTable, page);
    }

    document.getElementById('refresh-btn').addEventListener('click', async () => {
      if (!currentTable) return;
      
      const icon = document.getElementById('refresh-icon');
      icon.classList.add('spinning');
      
      try {
        await selectTable(currentTable);
      } catch (e) {
        console.error("Failed to refresh data", e);
      } finally {
        setTimeout(() => { icon.classList.remove('spinning'); }, 500);
      }
    });

    // Init
    loadTables();
  </script>
</body>
</html>
`;
