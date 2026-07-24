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
    
    input[type="checkbox"] {
      appearance: none;
      background-color: transparent;
      border: 1px solid #8f8f91;
      border-radius: 3px;
      width: 14px;
      height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      margin: 0;
    }
    input[type="checkbox"]:checked {
      background-color: #00e599;
      border-color: #00e599;
    }
    input[type="checkbox"]:checked::after {
      content: '';
      width: 4px;
      height: 7px;
      border: solid #161618;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
      margin-top: -1px;
    }
  </style>
</head>
<body class="font-sans h-screen flex overflow-hidden text-sm selection:bg-accent/30">
  <div x-data="studioState()" class="flex h-screen w-full relative">
    
    <!-- Toast Notification Banner -->
    <div 
      x-show="toastOpen" 
      x-cloak 
      class="fixed bottom-6 right-6 z-50 max-w-md w-full border-2 rounded-lg shadow-2xl p-4 flex items-start gap-3 transition-all text-white bg-[#18181b] shadow-black/80"
      :class="toastType === 'error' ? 'border-red-500 bg-[#1c1917] text-red-200' : 'border-emerald-500 bg-[#064e3b] text-emerald-100'"
      style="display: none;"
    >
      <template x-if="toastType === 'error'">
        <svg class="w-5 h-5 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </template>
      <template x-if="toastType === 'success'">
        <svg class="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      </template>
      <div class="flex-1 min-w-0">
        <h4 class="font-semibold text-xs mb-1" x-text="toastTitle"></h4>
        <p class="text-xs opacity-90 font-mono break-words whitespace-pre-wrap max-h-36 overflow-y-auto" x-text="toastMessage"></p>
      </div>
      <button @click="toastOpen = false" class="text-muted hover:text-text p-1 rounded hover:bg-hover transition-colors shrink-0"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    </div>

    <!-- Confirm Delete Modal -->
    <div x-show="confirmModalOpen" x-cloak class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" style="display: none;">
      <div @click.away="confirmModalOpen = false" class="bg-panel border border-red-500/30 rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-border bg-bg/50">
          <h3 class="font-semibold text-red-400 text-sm flex items-center gap-2">
            <svg class="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Confirm Permanent Deletion
          </h3>
          <button @click="confirmModalOpen = false" class="text-muted hover:text-text p-1 rounded hover:bg-hover transition-colors"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div class="p-5 text-xs text-text flex flex-col gap-2">
          <p class="font-medium text-sm">Are you sure you want to delete <span class="text-red-400 font-semibold" x-text="confirmCount"></span> record(s)?</p>
          <p class="text-muted">This action cannot be undone. Any dependent foreign key relationships may cause the deletion to fail.</p>
        </div>
        <div class="flex items-center justify-end gap-3 p-4 border-t border-border bg-bg/30">
          <button @click="confirmModalOpen = false" class="px-4 py-2 rounded text-xs font-medium text-muted hover:text-text hover:bg-hover transition-colors">Cancel</button>
          <button @click="confirmModalOpen = false; if (confirmCallback) confirmCallback()" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
    
    <!-- Right Slide-over Sheet Modal (Add / Edit Record) -->
    <div x-show="sheetOpen" x-cloak class="fixed inset-0 z-50 overflow-hidden" style="display: none;">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="sheetOpen = false"></div>
      
      <div class="fixed inset-y-0 right-0 max-w-lg w-full bg-panel border-l border-border shadow-2xl flex flex-col transform transition-transform duration-300">
        <!-- Sheet Header -->
        <div class="flex items-center justify-between p-4 border-b border-border bg-bg/50">
          <div class="flex items-center gap-2">
            <template x-if="sheetMode === 'add'">
              <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="18" y1="12" x2="6" y2="12"></line></svg>
            </template>
            <template x-if="sheetMode === 'edit'">
              <svg class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </template>
            <div>
              <h3 class="font-semibold text-text text-sm" x-text="sheetMode === 'add' ? 'Add New Record' : 'Edit Record'"></h3>
              <p class="text-[11px] text-muted" x-text="'Table: ' + sheetTableName"></p>
            </div>
          </div>
          <button @click="sheetOpen = false" class="text-muted hover:text-text p-1 rounded hover:bg-hover transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <!-- Sheet Body: JSON Editor -->
        <div class="p-4 flex-1 overflow-auto flex flex-col gap-3 bg-bg">
          <div class="flex items-center justify-between text-xs text-muted">
            <span>JSON Record Payload</span>
            <button @click="formatSheetJson()" class="text-accent hover:underline text-[11px] cursor-pointer">Format JSON</button>
          </div>
          <textarea 
            x-model="sheetJson" 
            class="flex-1 w-full font-mono text-xs text-text bg-panel p-4 rounded border border-border focus:outline-none focus:border-accent resize-none min-h-[300px]"
            placeholder='{ "column": "value" }'
          ></textarea>
          <p x-show="sheetError" class="text-xs text-red-400 font-mono bg-red-500/10 p-2 rounded border border-red-500/20" x-text="sheetError"></p>
        </div>

        <!-- Sheet Footer -->
        <div class="flex items-center justify-end gap-3 p-4 border-t border-border bg-bg/50">
          <button @click="sheetOpen = false" class="px-4 py-2 rounded text-xs font-medium text-muted hover:text-text hover:bg-hover transition-colors">Cancel</button>
          <button 
            @click="submitSheetPayload()" 
            class="bg-accent hover:bg-accent/90 text-white px-5 py-2 rounded text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span x-text="sheetMode === 'add' ? 'Create Record' : 'Save Changes'"></span>
          </button>
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

      <!-- Search Box & Refresh Button -->
      <div class="p-3 border-b border-border bg-bg flex items-center gap-2">
        <div class="relative flex-1">
          <svg class="w-4 h-4 text-muted absolute left-2.5 top-2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" x-model="searchQuery" placeholder="Filter tables.." class="w-full bg-panel border border-border rounded pl-8 pr-2 py-1 text-sm focus:outline-none focus:border-muted text-text placeholder-muted">
        </div>
        <button 
          @click="loadSidebar()" 
          class="p-1.5 bg-panel border border-border rounded text-muted hover:text-text hover:bg-hover transition-colors shrink-0 flex items-center justify-center cursor-pointer"
          title="Refresh Tables List"
        >
          <svg class="w-4 h-4 transition-transform duration-500" :class="isRefreshingSidebar ? 'animate-spin text-accent' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </button>
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
            <template x-if="tab.type === 'table' && tab.tableType === 'r'">
              <svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </template>
            <template x-if="tab.type === 'table' && tab.tableType === 'v'">
              <svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </template>
            <template x-if="tab.type === 'table' && tab.tableType === 'm'">
              <svg class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
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
                <div class="h-12 border-b border-border flex items-center justify-between px-3 shrink-0 bg-panel gap-3">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <!-- Multi-Column Search Input -->
                    <div class="relative flex-1 max-w-md">
                      <svg class="w-3.5 h-3.5 text-muted absolute left-2.5 top-2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                      <input 
                        type="text" 
                        placeholder="Search all columns (text, numbers, JSON)..." 
                        x-model="tab.searchQuery"
                        @input.debounce.300ms="htmx.ajax('GET', '/htmx/tables/' + tab.name + '?schema=' + tab.schema + '&tabId=' + tab.id + '&q=' + encodeURIComponent($event.target.value) + '&page=1&limit=25', {target: '#data-' + tab.id})"
                        class="w-full bg-bg border border-border rounded pl-8 pr-7 py-1 text-xs focus:outline-none focus:border-accent text-text placeholder-muted transition-colors"
                      >
                      <button 
                        x-show="tab.searchQuery" 
                        @click="tab.searchQuery = ''; htmx.ajax('GET', '/htmx/tables/' + tab.name + '?schema=' + tab.schema + '&tabId=' + tab.id + '&q=&page=1&limit=25', {target: '#data-' + tab.id})"
                        class="absolute right-2 top-1.5 text-muted hover:text-text p-0.5 rounded transition-colors"
                        title="Clear search"
                      >
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>

                    <!-- Default Toolbar Mode (0 selected) -->
                    <template x-if="!tab.selectedIds || tab.selectedIds.length === 0">
                      <div class="flex items-center gap-2">
                        <!-- Filter Button & Popover -->
                        <div class="relative" x-data="{ open: false }">
                          <button 
                            @click="loadColumnsIfNeeded(tab); open = !open" 
                            :class="tab.filterCol ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted hover:text-text bg-panel'"
                            class="px-2.5 py-1 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            <span x-text="tab.filterCol ? 'Filter: ' + tab.filterCol : 'Filter'"></span>
                          </button>
                          
                          <div x-show="open" @click.away="open = false" x-cloak class="absolute left-0 top-full mt-2 z-40 w-64 bg-panel border border-border rounded-lg shadow-2xl p-3 flex flex-col gap-2.5">
                            <div class="flex items-center justify-between">
                              <span class="text-xs font-semibold text-text">Filter Records</span>
                              <button x-show="tab.filterCol" @click="tab.filterCol = ''; tab.filterOp = 'like'; tab.filterVal = ''; applyTableQuery(tab); open = false;" class="text-[10px] text-red-400 hover:underline">Clear</button>
                            </div>
                            <div>
                              <label class="text-[10px] text-muted block mb-1">Column</label>
                              <select x-model="tab.filterCol" class="w-full bg-bg border border-border text-xs rounded px-2 py-1 text-text focus:outline-none">
                                <option value="">Select column...</option>
                                <template x-for="col in (tab.columns || [])" :key="col">
                                  <option :value="col" x-text="col"></option>
                                </template>
                              </select>
                            </div>
                            <div>
                              <label class="text-[10px] text-muted block mb-1">Operator</label>
                              <select x-model="tab.filterOp" class="w-full bg-bg border border-border text-xs rounded px-2 py-1 text-text focus:outline-none">
                                <option value="like">Contains (LIKE)</option>
                                <option value="eq">Equals (=)</option>
                                <option value="neq">Not Equals (!=)</option>
                                <option value="gt">Greater Than (&gt;)</option>
                                <option value="lt">Less Than (&lt;)</option>
                                <option value="null">Is Null</option>
                                <option value="notnull">Is Not Null</option>
                              </select>
                            </div>
                            <div x-show="tab.filterOp !== 'null' && tab.filterOp !== 'notnull'">
                              <label class="text-[10px] text-muted block mb-1">Value</label>
                              <input type="text" x-model="tab.filterVal" placeholder="Enter value..." class="w-full bg-bg border border-border text-xs rounded px-2 py-1 text-text focus:outline-none">
                            </div>
                            <button @click="applyTableQuery(tab); open = false;" class="w-full bg-accent hover:bg-accent/90 text-white py-1 rounded text-xs font-medium transition-colors cursor-pointer">Apply Filter</button>
                          </div>
                        </div>

                        <!-- Sort Button & Popover -->
                        <div class="relative" x-data="{ open: false }">
                          <button 
                            @click="loadColumnsIfNeeded(tab); open = !open" 
                            :class="tab.sortBy ? 'border-accent text-accent bg-accent/10' : 'border-border text-muted hover:text-text bg-panel'"
                            class="px-2.5 py-1 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
                            <span x-text="tab.sortBy ? 'Sort: ' + tab.sortBy + ' (' + (tab.sortDir || 'ASC') + ')' : 'Sort'"></span>
                          </button>
                          
                          <div x-show="open" @click.away="open = false" x-cloak class="absolute left-0 top-full mt-2 z-40 w-56 bg-panel border border-border rounded-lg shadow-2xl p-3 flex flex-col gap-2.5">
                            <div class="flex items-center justify-between">
                              <span class="text-xs font-semibold text-text">Sort Records</span>
                              <button x-show="tab.sortBy" @click="tab.sortBy = ''; tab.sortDir = 'ASC'; applyTableQuery(tab); open = false;" class="text-[10px] text-red-400 hover:underline">Clear</button>
                            </div>
                            <div>
                              <label class="text-[10px] text-muted block mb-1">Sort Column</label>
                              <select x-model="tab.sortBy" class="w-full bg-bg border border-border text-xs rounded px-2 py-1 text-text focus:outline-none">
                                <option value="">Select column...</option>
                                <template x-for="col in (tab.columns || [])" :key="col">
                                  <option :value="col" x-text="col"></option>
                                </template>
                              </select>
                            </div>
                            <div>
                              <label class="text-[10px] text-muted block mb-1">Direction</label>
                              <select x-model="tab.sortDir" class="w-full bg-bg border border-border text-xs rounded px-2 py-1 text-text focus:outline-none">
                                <option value="ASC">Ascending (A-Z, 0-9)</option>
                                <option value="DESC">Descending (Z-A, 9-0)</option>
                              </select>
                            </div>
                            <button @click="applyTableQuery(tab); open = false;" class="w-full bg-accent hover:bg-accent/90 text-white py-1 rounded text-xs font-medium transition-colors cursor-pointer">Apply Sort</button>
                          </div>
                        </div>

                        <!-- Add Record Button -->
                        <button 
                          @click="openAddSheet(tab)"
                          class="bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="18" y1="12" x2="6" y2="12"></line></svg>
                          Add Record
                        </button>
                      </div>
                    </template>

                    <!-- Selected Toolbar Mode (1+ selected) -->
                    <template x-if="tab.selectedIds && tab.selectedIds.length > 0">
                      <div class="flex items-center gap-2">
                        <!-- Edit Button (Visible when exactly 1 row selected) -->
                        <button 
                          x-show="tab.selectedIds.length === 1"
                          @click="openEditSheet(tab)"
                          class="bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          Edit
                        </button>

                        <!-- Delete Selected Button -->
                        <button 
                          @click="window.dispatchEvent(new CustomEvent('open-confirm-delete', { detail: { count: tab.selectedIds.length, callback: () => performDelete(tab) } }))"
                          class="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          <svg class="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          Delete (<span x-text="tab.selectedIds.length"></span>)
                        </button>
                      </div>
                    </template>
                  </div>
                  <!-- HTMX will swap the pagination controls into this div -->
                  <div class="flex items-center gap-2 shrink-0">
                    <div :id="'pagination-' + tab.id" class="flex items-center gap-2 shrink-0"></div>
                    <button 
                      @click="refreshTable(tab)"
                      class="p-1.5 bg-panel border border-border rounded text-muted hover:text-text hover:bg-hover transition-colors flex items-center justify-center cursor-pointer shrink-0"
                      title="Refresh Table Data"
                    >
                      <svg class="w-3.5 h-3.5 transition-transform duration-500" :class="tab.isRefreshing ? 'animate-spin text-accent' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <!-- Table Data Grid Container -->
                <div class="flex-1 overflow-auto bg-bg" :id="'data-' + tab.id" 
                     x-init="htmx.ajax('GET', '/htmx/tables/' + tab.name + '?schema=' + tab.schema + '&tabId=' + tab.id, {target: '#data-' + tab.id})">
                   <div class="w-full flex flex-col">
                     <div class="h-9 bg-panel border-b border-border flex items-center px-4 gap-6">
                       <div class="w-4 h-4 rounded bg-border animate-pulse"></div>
                       <div class="w-24 h-3 rounded bg-border animate-pulse"></div>
                       <div class="w-32 h-3 rounded bg-border animate-pulse"></div>
                       <div class="w-20 h-3 rounded bg-border animate-pulse"></div>
                     </div>
                     <div class="h-10 border-b border-border flex items-center px-4 gap-6 opacity-80">
                       <div class="w-4 h-4 rounded bg-panel animate-pulse"></div>
                       <div class="w-32 h-3 rounded bg-panel animate-pulse"></div>
                       <div class="w-48 h-3 rounded bg-panel animate-pulse"></div>
                       <div class="w-24 h-3 rounded bg-panel animate-pulse"></div>
                     </div>
                     <div class="h-10 border-b border-border flex items-center px-4 gap-6 opacity-60">
                       <div class="w-4 h-4 rounded bg-panel animate-pulse"></div>
                       <div class="w-28 h-3 rounded bg-panel animate-pulse"></div>
                       <div class="w-40 h-3 rounded bg-panel animate-pulse"></div>
                       <div class="w-32 h-3 rounded bg-panel animate-pulse"></div>
                     </div>
                     <div class="h-10 border-b border-border flex items-center px-4 gap-6 opacity-40">
                       <div class="w-4 h-4 rounded bg-panel animate-pulse"></div>
                       <div class="w-36 h-3 rounded bg-panel animate-pulse"></div>
                       <div class="w-52 h-3 rounded bg-panel animate-pulse"></div>
                       <div class="w-28 h-3 rounded bg-panel animate-pulse"></div>
                     </div>
                   </div>
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
        toastOpen: false,
        toastType: 'info',
        toastTitle: '',
        toastMessage: '',
        confirmModalOpen: false,
        confirmCount: 0,
        confirmCallback: null,
        isRefreshingSidebar: false,
        sheetOpen: false,
        sheetMode: 'add',
        sheetTableName: '',
        sheetSchema: '',
        sheetTabId: '',
        sheetJson: '{}',
        sheetError: '',
        
        init() {
          this.$watch('activeTab', (value) => {
             this.toastOpen = false;
             const tab = this.tabs.find(t => t.id === value);
             if (tab) {
               if (tab.schema && tab.schema !== this.currentSchema) {
                  this.currentSchema = tab.schema;
                  this.loadSidebar();
               }
               this.ensureTabLoaded(tab);
             }
             this.syncUrlHash();
          });

          const restored = this.restoreUrlHash();

          if (restored) {
            this.$nextTick(() => {
              const activeTabObj = this.tabs.find(t => t.id === this.activeTab);
              if (activeTabObj) this.ensureTabLoaded(activeTabObj);
            });
          }

          // Listen for table clicks from the sidebar
          window.addEventListener('open-table', (e) => {
            this.toastOpen = false;
            const tableName = e.detail.tableName;
            const tableType = e.detail.tableType || 'r';
            const schema = this.currentSchema;
            const tabId = 'table_' + schema + '_' + tableName;
            
            let tabObj = this.tabs.find(t => t.id === tabId);
            if (!tabObj) {
              tabObj = { id: tabId, type: 'table', tableType: tableType, title: tableName, name: tableName, schema: schema, searchQuery: '', selectedIds: [], columns: [] };
              this.tabs.push(tabObj);
            }
            this.activeTab = tabId;
            this.syncUrlHash();
            this.ensureTabLoaded(tabObj);
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

          window.addEventListener('show-toast', (e) => {
            this.toastType = e.detail.type || 'info';
            this.toastTitle = e.detail.title || '';
            this.toastMessage = e.detail.message || '';
            this.toastOpen = true;
            if (this.toastType === 'error') {
              this.sheetError = e.detail.message || 'Operation failed';
            } else if (this.toastType === 'success') {
              this.sheetOpen = false;
              this.sheetError = '';
              setTimeout(() => { this.toastOpen = false; }, 4000);
            }
          });

          window.addEventListener('open-confirm-delete', (e) => {
            this.confirmCount = e.detail.count || 0;
            this.confirmCallback = e.detail.callback || null;
            this.confirmModalOpen = true;
          });
        },

        ensureTabLoaded(tab) {
          if (!tab || tab.type !== 'table') return;
          if (tab._loading) return;
          tab._loading = true;
          this.$nextTick(() => {
            const el = document.getElementById('data-' + tab.id);
            if (el && !el.querySelector('table')) {
              htmx.ajax('GET', '/htmx/tables/' + tab.name + '?schema=' + tab.schema + '&tabId=' + tab.id + (tab.searchQuery ? '&q=' + encodeURIComponent(tab.searchQuery) : ''), { target: '#data-' + tab.id }).then(() => { tab._loading = false; }).catch(() => { tab._loading = false; });
            } else {
              tab._loading = false;
            }
          });
        },

        syncUrlHash() {
          if (this.tabs.length === 0) {
            history.replaceState(null, '', window.location.pathname);
            return;
          }
          const tabList = this.tabs.map(t => {
            if (t.type === 'query') return 'query:' + t.id;
            return (t.schema || 'public') + ':' + t.name;
          }).join(',');

          const activeTabObj = this.tabs.find(t => t.id === this.activeTab);
          let activeStr = '';
          if (activeTabObj) {
            if (activeTabObj.type === 'query') activeStr = 'query:' + activeTabObj.id;
            else activeStr = (activeTabObj.schema || 'public') + ':' + activeTabObj.name;
          }

          const hash = '#tabs=' + encodeURIComponent(tabList) + '&active=' + encodeURIComponent(activeStr);
          history.replaceState(null, '', hash);
        },

        restoreUrlHash() {
          const rawHash = window.location.hash.substring(1);
          if (!rawHash) return false;
          const params = new URLSearchParams(rawHash);
          const tabsStr = params.get('tabs');
          const activeStr = params.get('active');

          if (!tabsStr) return false;

          const rawTabs = tabsStr.split(',');
          let restoredActiveId = null;

          rawTabs.forEach(raw => {
            const parts = raw.split(':');
            if (parts[0] === 'query') {
              const qId = parts[1] || 'query_1';
              const tabId = qId;
              if (!this.tabs.find(t => t.id === tabId)) {
                this.tabs.push({ id: tabId, type: 'query', title: 'Query Editor', schema: this.currentSchema });
              }
              if (raw === activeStr) restoredActiveId = tabId;
            } else if (parts.length >= 2) {
              const schema = parts[0];
              const tableName = parts[1];
              const tabId = 'table_' + schema + '_' + tableName;
              if (!this.tabs.find(t => t.id === tabId)) {
                this.tabs.push({ id: tabId, type: 'table', tableType: 'r', title: tableName, name: tableName, schema: schema, searchQuery: '', selectedIds: [], columns: [] });
              }
              if (raw === activeStr) restoredActiveId = tabId;
            }
          });

          if (restoredActiveId) {
            this.activeTab = restoredActiveId;
          } else if (this.tabs.length > 0) {
            this.activeTab = this.tabs[0].id;
          }
          return true;
        },
        loadColumnsIfNeeded(tab) {
          if (!tab || tab.type !== 'table') return;
          if (tab.columns && tab.columns.length > 0) return;
          fetch('/htmx/tables/' + tab.name + '/columns?schema=' + (tab.schema || 'public'))
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data.columns)) {
                tab.columns = data.columns.map(c => typeof c === 'string' ? c : c.name);
              }
            })
            .catch(() => {});
        },

        applyTableQuery(tab) {
          if (!tab || tab.type !== 'table') return;
          let url = '/htmx/tables/' + tab.name + '?schema=' + tab.schema + '&tabId=' + tab.id + '&page=1&limit=25';
          if (tab.searchQuery) url += '&q=' + encodeURIComponent(tab.searchQuery);
          if (tab.filterCol) url += '&filterCol=' + encodeURIComponent(tab.filterCol) + '&filterOp=' + encodeURIComponent(tab.filterOp || 'like') + '&filterVal=' + encodeURIComponent(tab.filterVal || '');
          if (tab.sortBy) url += '&sortBy=' + encodeURIComponent(tab.sortBy) + '&sortDir=' + encodeURIComponent(tab.sortDir || 'ASC');
          htmx.ajax('GET', url, { target: '#data-' + tab.id });
        },

        async openAddSheet(tab) {
          this.sheetMode = 'add';
          this.sheetTableName = tab.name;
          this.sheetSchema = tab.schema;
          this.sheetTabId = tab.id;
          this.sheetError = '';

          let cols = [];

          try {
            const res = await fetch('/htmx/tables/' + tab.name + '/columns?schema=' + tab.schema);
            const data = await res.json();
            if (Array.isArray(data.columns)) {
              cols = data.columns;
            }
          } catch(e) {}

          if (cols.length === 0 && tab.columns) {
            cols = tab.columns.map(c => typeof c === 'string' ? { name: c, type: 'text' } : c);
          }

          const getTypeDefault = (typeStr) => {
            const t = String(typeStr || '').toLowerCase();
            if (t.includes('bool')) return true;
            if (t.includes('int') || t.includes('num') || t.includes('decimal') || t.includes('float') || t.includes('double') || t.includes('real')) return 0;
            if (t.includes('jsonb') || t.includes('json')) return {};
            if (t.includes('[]') || t.includes('array')) return [];
            return '';
          };

          const templateObj = {};
          cols.forEach(colObj => {
            const colName = typeof colObj === 'string' ? colObj : colObj.name;
            const colType = typeof colObj === 'string' ? '' : colObj.type;
            if (colName !== 'id' && colName !== 'created_at' && colName !== 'createdAt' && colName !== 'updated_at' && colName !== 'updatedAt') {
              templateObj[colName] = getTypeDefault(colType);
            }
          });

          if (Object.keys(templateObj).length === 0 && cols.length > 0) {
            cols.forEach(colObj => {
              const colName = typeof colObj === 'string' ? colObj : colObj.name;
              templateObj[colName] = '';
            });
          }

          this.sheetJson = JSON.stringify(templateObj, null, 2);
          this.sheetOpen = true;
        },

        openEditSheet(tab) {
          if (!tab.selectedIds || tab.selectedIds.length !== 1) return;
          const pkVal = tab.selectedIds[0];
          this.sheetMode = 'edit';
          this.sheetTableName = tab.name;
          this.sheetSchema = tab.schema;
          this.sheetTabId = tab.id;
          this.sheetError = '';
          
          fetch('/htmx/tables/' + tab.name + '/row?schema=' + tab.schema + '&pk=' + encodeURIComponent(pkVal))
            .then(res => res.json())
            .then(data => {
              this.sheetJson = JSON.stringify(data, null, 2);
              this.sheetOpen = true;
            })
            .catch(err => {
              this.sheetError = 'Failed to load record details';
              this.sheetOpen = true;
            });
        },

        formatSheetJson() {
          try {
            const parsed = JSON.parse(this.sheetJson);
            this.sheetJson = JSON.stringify(parsed, null, 2);
            this.sheetError = '';
          } catch(e) {
            this.sheetError = 'Invalid JSON: ' + e.message;
          }
        },

        submitSheetPayload() {
          try {
            const parsed = JSON.parse(this.sheetJson);
            this.sheetError = '';
            const endpoint = this.sheetMode === 'add' ? '/htmx/tables/' + this.sheetTableName + '/insert' : '/htmx/tables/' + this.sheetTableName + '/update';
            htmx.ajax('POST', endpoint, {
              target: '#data-' + this.sheetTabId,
              values: { schema: this.sheetSchema, tabId: this.sheetTabId, payload: JSON.stringify(parsed) }
            }).then(() => {
              const tab = this.tabs.find(t => t.id === this.sheetTabId);
              if (tab) tab.selectedIds = [];
            }).catch((err) => {
              this.sheetError = 'Failed: ' + (err.message || 'Server error');
            });
          } catch(e) {
            this.sheetError = 'Invalid JSON payload: ' + e.message;
          }
        },

        performDelete(tab) {
          htmx.ajax('POST', '/htmx/tables/' + tab.name + '/delete', {
            target: '#data-' + tab.id,
            values: { schema: tab.schema, ids: JSON.stringify(tab.selectedIds), tabId: tab.id }
          }).then(() => { tab.selectedIds = []; });
        },
        
        syntaxHighlight(json) {
          if (!json || json === 'Invalid JSON data') return json;
          json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'text-emerald-400';
            if (/^"/.test(match)) {
              if (/:$/.test(match)) {
                cls = 'text-blue-400';
              } else {
                cls = 'text-orange-300';
              }
            } else if (/true|false/.test(match)) {
              cls = 'text-purple-400';
            } else if (/null/.test(match)) {
              cls = 'text-muted';
            } else {
              cls = 'text-teal-400';
            }
            return '<span class="' + cls + '">' + match + '</span>';
          });
        },
        
        loadSidebar() {
          this.isRefreshingSidebar = true;
          htmx.ajax('GET', '/htmx/sidebar?schema=' + this.currentSchema, { target: '#sidebar-content' }).then(() => {
            setTimeout(() => { this.isRefreshingSidebar = false; }, 500);
          }).catch(() => {
            this.isRefreshingSidebar = false;
          });
        },

        refreshTable(tab) {
          if (!tab || tab.type !== 'table') return;
          tab.isRefreshing = true;
          const url = '/htmx/tables/' + tab.name + '?schema=' + tab.schema + '&tabId=' + tab.id + (tab.searchQuery ? '&q=' + encodeURIComponent(tab.searchQuery) : '');
          htmx.ajax('GET', url, { target: '#data-' + tab.id }).then(() => {
            setTimeout(() => { tab.isRefreshing = false; }, 500);
          }).catch(() => {
            tab.isRefreshing = false;
          });
        },
        
        openQueryEditor() {
          this.queryEditorCount++;
          const tabId = 'query_' + this.queryEditorCount;
          this.tabs.push({ id: tabId, type: 'query', title: 'Query Editor ' + (this.queryEditorCount > 1 ? this.queryEditorCount : ''), schema: this.currentSchema });
          this.activeTab = tabId;
          this.syncUrlHash();
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
          this.syncUrlHash();
        }
      }
    }
  </script>
</body>
</html>`;
}
