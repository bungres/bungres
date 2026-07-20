export function renderIndexHtml(opts: { schemas: string[], currentSchema: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bungres Studio</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <script src="https://unpkg.com/htmx.org@2.0.0" defer></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            bg: '#161618',
            panel: '#1c1c1f',
            border: '#2c2c2f',
            text: '#ededed',
            muted: '#8f8f91',
            accent: '#00e599',
            hover: '#28282c'
          }
        }
      }
    }
  </script>

  <style>
    body { background-color: #161618; color: #ededed; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #3a3a3e; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #4a4a4e; }
    ::-webkit-scrollbar-corner { background: transparent; }
    [x-cloak] { display: none !important; }
    
    .tab-active { background-color: #1c1c1f; border-top: 2px solid #00e599; color: #ededed; }
    .tab-inactive { background-color: #161618; border-top: 2px solid transparent; color: #8f8f91; }
    
    table { border-spacing: 0; }
    th { border-bottom: 1px solid #2c2c2f; border-right: 1px solid #2c2c2f; background: #1c1c1f; font-weight: 500; font-size: 13px; color: #8f8f91; }
    td { border-bottom: 1px solid #2c2c2f; border-right: 1px solid #2c2c2f; font-size: 13px; }
    tr:hover td { background-color: #28282c; }
  </style>
</head>
<body class="font-sans h-screen flex overflow-hidden text-sm selection:bg-accent/30">
  <div x-data="studioState()" class="flex h-screen w-full relative">
    
    <!-- JSON Modal -->
    <div x-show="jsonModalOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity" style="display: none;">
      <div @click.away="jsonModalOpen = false" class="bg-panel border border-border rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
        <div class="flex items-center justify-between p-3 border-b border-border bg-bg/50">
          <h3 class="font-medium text-text text-xs flex items-center gap-2">
            <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            Data Viewer
          </h3>
          <button @click="jsonModalOpen = false" class="text-muted hover:text-text p-1 rounded hover:bg-hover transition-colors"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div class="p-4 overflow-auto flex-1">
          <pre class="font-mono text-xs text-text bg-bg p-4 rounded border border-border whitespace-pre-wrap break-all" x-text="jsonModalData"></pre>
        </div>
      </div>
    </div>
    
    <!-- Sidebar -->
    <aside class="w-64 bg-bg border-r border-border flex flex-col z-20 shrink-0">
      
      <!-- Schema Selector -->
      <div class="p-3 border-b border-border">
        <select x-model="currentSchema" @change="loadSidebar()" class="w-full bg-panel border border-border text-text text-sm rounded px-2 py-1.5 focus:outline-none focus:border-muted cursor-pointer font-medium">
          <template x-for="s in schemas" :key="s">
            <option :value="s" x-text="s"></option>
          </template>
        </select>
      </div>

      <!-- Search Box -->
      <div class="p-3 border-b border-border bg-bg">
        <div class="relative">
          <svg class="w-4 h-4 text-muted absolute left-2.5 top-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" x-model="searchQuery" placeholder="Filter tables.." class="w-full bg-panel border border-border rounded pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:border-muted text-text placeholder-muted">
        </div>
      </div>

      <!-- Tables List -->
      <div class="flex-1 overflow-y-auto pt-2" id="sidebar-content" :hx-get="'/htmx/sidebar?schema=' + currentSchema" hx-trigger="load">
        <div class="p-4 text-xs text-muted animate-pulse text-center">Loading...</div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 bg-panel">
      <!-- Tabs Header -->
      <header class="h-10 border-b border-border flex items-center bg-bg shrink-0 overflow-x-auto overflow-y-hidden">
        <template x-for="tab in tabs" :key="tab.id">
          <div 
            @click="activeTab = tab.id"
            :class="activeTab === tab.id ? 'tab-active' : 'tab-inactive hover:bg-panel hover:text-text'"
            class="h-full flex items-center gap-2 pl-4 pr-2 cursor-pointer border-r border-border min-w-max transition-colors group relative select-none"
          >
            <!-- Icon -->
            <template x-if="tab.type === 'table'">
              <svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </template>
            <template x-if="tab.type === 'query'">
              <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            </template>
            
            <span x-text="tab.title" class="font-medium text-xs mr-2"></span>
            
            <!-- Close Button -->
            <button @click.stop="closeTab(tab.id)" class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-hover text-muted hover:text-text transition-opacity">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </template>
        <button @click="openQueryEditor()" class="h-full px-3 text-muted hover:text-text hover:bg-panel flex items-center justify-center transition-colors">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </header>

      <!-- Active Tab Content Container -->
      <div class="flex-1 relative overflow-hidden bg-panel">
        
        <!-- Empty State -->
        <div x-show="tabs.length === 0" class="absolute inset-0 flex flex-col items-center justify-center text-muted">
          <div class="w-12 h-12 rounded-lg bg-hover border border-border flex items-center justify-center mb-4">
            <svg class="w-6 h-6 text-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          </div>
          <p class="text-sm">Select a table to view</p>
        </div>

        <!-- Render Tabs -->
        <template x-for="tab in tabs" :key="tab.id">
          <div x-show="activeTab === tab.id" class="absolute inset-0 flex flex-col h-full w-full">
            
            <!-- Table View -->
            <template x-if="tab.type === 'table'">
              <div class="flex flex-col h-full w-full">
                <!-- Table Header Toolbars -->
                <div class="h-12 border-b border-border flex items-center justify-between px-3 shrink-0 bg-panel">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted font-medium ml-1 flex items-center gap-2">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                      <span x-text="tab.title"></span>
                    </span>
                  </div>
                  <!-- HTMX will swap the pagination controls into this div -->
                  <div :id="'pagination-' + tab.id" class="flex items-center gap-2"></div>
                </div>
                
                <!-- Table Data Grid Container -->
                <div class="flex-1 overflow-auto bg-bg" :id="'data-' + tab.id" 
                     x-init="htmx.ajax('GET', '/htmx/tables/' + tab.name + '?schema=' + tab.schema + '&tabId=' + tab.id, {target: '#data-' + tab.id})">
                   <div class="p-8 text-center text-muted">Loading data...</div>
                </div>
              </div>
            </template>
            
            <!-- Query Editor View -->
            <template x-if="tab.type === 'query'">
              <div class="flex flex-col h-full w-full" x-data="{ query: 'SELECT 1;' }">
                <div class="h-12 border-b border-border flex items-center px-3 shrink-0 gap-2 bg-panel">
                  <button 
                    @click="htmx.ajax('POST', '/htmx/query', { target: '#query-result-' + tab.id, values: { query: query } })"
                    class="bg-accent text-bg px-3 py-1.5 rounded text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 transition-opacity"
                  >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run
                  </button>
                  <span class="text-muted text-[10px] font-mono ml-2">Press Ctrl+Enter to run</span>
                </div>
                <div class="flex-none h-48 border-b border-border relative">
                  <textarea 
                    x-model="query"
                    @keydown.ctrl.enter.prevent="htmx.ajax('POST', '/htmx/query', { target: '#query-result-' + tab.id, values: { query: query } })"
                    class="absolute inset-0 w-full h-full bg-bg text-text font-mono text-sm p-4 focus:outline-none resize-none" 
                    placeholder="SELECT 1;"
                  ></textarea>
                </div>
                <div class="flex-1 overflow-auto bg-bg flex flex-col" :id="'query-result-' + tab.id">
                  <div class="h-full flex items-center justify-center text-muted">
                    <div class="flex flex-col items-center">
                      <svg class="w-6 h-6 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                      <span class="text-xs">Run a query to see results</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            
          </div>
        </template>
      </div>
    </main>
  </div>
  <script>
    const INITIAL_SCHEMAS = ${JSON.stringify(opts.schemas)};
    const INITIAL_CURRENT_SCHEMA = ${JSON.stringify(opts.currentSchema)};

    function studioState() {
      return {
        schemas: INITIAL_SCHEMAS,
        currentSchema: INITIAL_CURRENT_SCHEMA,
        searchQuery: '',
        tabs: [],
        activeTab: null,
        queryEditorCount: 0,
        jsonModalOpen: false,
        jsonModalData: '',
        
        init() {
          this.$watch('activeTab', (value) => {
             const tab = this.tabs.find(t => t.id === value);
             if (tab && tab.schema && tab.schema !== this.currentSchema) {
                this.currentSchema = tab.schema;
                this.loadSidebar();
             }
          });

          // Listen for table clicks from the sidebar
          window.addEventListener('open-table', (e) => {
            const tableName = e.detail.tableName;
            const schema = this.currentSchema;
            const tabId = 'table_' + schema + '_' + tableName;
            
            if (!this.tabs.find(t => t.id === tabId)) {
              this.tabs.push({ id: tabId, type: 'table', title: tableName, name: tableName, schema: schema });
            }
            this.activeTab = tabId;
          });

          window.addEventListener('open-json-modal', (e) => {
            try {
              const str = atob(e.detail);
              this.jsonModalData = JSON.stringify(JSON.parse(str), null, 2);
            } catch(err) {
              this.jsonModalData = 'Invalid JSON data';
            }
            this.jsonModalOpen = true;
          });
        },
        
        loadSidebar() {
          htmx.ajax('GET', '/htmx/sidebar?schema=' + this.currentSchema, {target: '#sidebar-content'});
        },
        
        openQueryEditor() {
          this.queryEditorCount++;
          const tabId = 'query_' + this.queryEditorCount;
          this.tabs.push({ id: tabId, type: 'query', title: 'Query Editor ' + (this.queryEditorCount > 1 ? this.queryEditorCount : ''), schema: this.currentSchema });
          this.activeTab = tabId;
        },
        
        closeTab(id) {
          const idx = this.tabs.findIndex(t => t.id === id);
          if (idx === -1) return;
          
          this.tabs.splice(idx, 1);
          if (this.activeTab === id) {
            if (this.tabs.length > 0) {
              this.activeTab = this.tabs[Math.max(0, idx - 1)].id;
            } else {
              this.activeTab = null;
            }
          }
        }
      }
    }
  </script>
</body>
</html>`;
}
