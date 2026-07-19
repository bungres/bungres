export const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bungres Studio</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">

  <script src="https://unpkg.com/htmx.org@2.0.0" defer></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  
  <script>
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          fontFamily: {
            sans: ['Outfit', 'sans-serif'],
            mono: ['"Fira Code"', 'monospace'],
          },
          colors: {
            background: 'var(--background)',
            foreground: 'var(--foreground)',
            card: 'var(--card)',
            'card-foreground': 'var(--card-foreground)',
            popover: 'var(--popover)',
            'popover-foreground': 'var(--popover-foreground)',
            primary: 'var(--primary)',
            'primary-foreground': 'var(--primary-foreground)',
            secondary: 'var(--secondary)',
            'secondary-foreground': 'var(--secondary-foreground)',
            muted: 'var(--muted)',
            'muted-foreground': 'var(--muted-foreground)',
            accent: 'var(--accent)',
            'accent-foreground': 'var(--accent-foreground)',
            destructive: 'var(--destructive)',
            border: 'var(--border)',
            input: 'var(--input)',
            ring: 'var(--ring)',
            sidebar: {
              DEFAULT: 'var(--sidebar)',
              foreground: 'var(--sidebar-foreground)',
              primary: 'var(--sidebar-primary)',
              'primary-foreground': 'var(--sidebar-primary-foreground)',
              accent: 'var(--sidebar-accent)',
              'accent-foreground': 'var(--sidebar-accent-foreground)',
              border: 'var(--sidebar-border)',
              ring: 'var(--sidebar-ring)',
            }
          }
        }
      }
    }
  </script>

  <style>
    :root {
      --background: oklch(1 0 0);
      --foreground: oklch(0.148 0.004 228.8);
      --card: oklch(1 0 0);
      --card-foreground: oklch(0.148 0.004 228.8);
      --popover: oklch(1 0 0);
      --popover-foreground: oklch(0.148 0.004 228.8);
      --primary: oklch(0.508 0.118 165.612);
      --primary-foreground: oklch(0.979 0.021 166.113);
      --secondary: oklch(0.967 0.001 286.375);
      --secondary-foreground: oklch(0.21 0.006 285.885);
      --muted: oklch(0.963 0.002 197.1);
      --muted-foreground: oklch(0.56 0.021 213.5);
      --accent: oklch(0.963 0.002 197.1);
      --accent-foreground: oklch(0.218 0.008 223.9);
      --destructive: oklch(0.577 0.245 27.325);
      --border: oklch(0.925 0.005 214.3);
      --input: oklch(0.925 0.005 214.3);
      --ring: oklch(0.723 0.014 214.4);
      --chart-1: oklch(0.845 0.143 164.978);
      --chart-2: oklch(0.696 0.17 162.48);
      --chart-3: oklch(0.596 0.145 163.225);
      --chart-4: oklch(0.508 0.118 165.612);
      --chart-5: oklch(0.432 0.095 166.913);
      --radius: 0.625rem;
      --sidebar: oklch(0.987 0.002 197.1);
      --sidebar-foreground: oklch(0.148 0.004 228.8);
      --sidebar-primary: oklch(0.596 0.145 163.225);
      --sidebar-primary-foreground: oklch(0.979 0.021 166.113);
      --sidebar-accent: oklch(0.963 0.002 197.1);
      --sidebar-accent-foreground: oklch(0.218 0.008 223.9);
      --sidebar-border: oklch(0.925 0.005 214.3);
      --sidebar-ring: oklch(0.723 0.014 214.4);
    }

    .dark {
      --background: oklch(0.148 0.004 228.8);
      --foreground: oklch(0.987 0.002 197.1);
      --card: oklch(0.218 0.008 223.9);
      --card-foreground: oklch(0.987 0.002 197.1);
      --popover: oklch(0.218 0.008 223.9);
      --popover-foreground: oklch(0.987 0.002 197.1);
      --primary: oklch(0.432 0.095 166.913);
      --primary-foreground: oklch(0.979 0.021 166.113);
      --secondary: oklch(0.274 0.006 286.033);
      --secondary-foreground: oklch(0.985 0 0);
      --muted: oklch(0.275 0.011 216.9);
      --muted-foreground: oklch(0.723 0.014 214.4);
      --accent: oklch(0.275 0.011 216.9);
      --accent-foreground: oklch(0.987 0.002 197.1);
      --destructive: oklch(0.704 0.191 22.216);
      --border: oklch(1 0 0 / 10%);
      --input: oklch(1 0 0 / 15%);
      --ring: oklch(0.56 0.021 213.5);
      --chart-1: oklch(0.845 0.143 164.978);
      --chart-2: oklch(0.696 0.17 162.48);
      --chart-3: oklch(0.596 0.145 163.225);
      --chart-4: oklch(0.508 0.118 165.612);
      --chart-5: oklch(0.432 0.095 166.913);
      --sidebar: oklch(0.218 0.008 223.9);
      --sidebar-foreground: oklch(0.987 0.002 197.1);
      --sidebar-primary: oklch(0.696 0.17 162.48);
      --sidebar-primary-foreground: oklch(0.262 0.051 172.552);
      --sidebar-accent: oklch(0.275 0.011 216.9);
      --sidebar-accent-foreground: oklch(0.987 0.002 197.1);
      --sidebar-border: oklch(1 0 0 / 10%);
      --sidebar-ring: oklch(0.56 0.021 213.5);
    }

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--muted-foreground); }
    ::-webkit-scrollbar-corner { background: transparent; }
    [x-cloak] { display: none !important; }
    .htmx-indicator { opacity: 0; transition: opacity 200ms ease-in; }
    .htmx-request .htmx-indicator { opacity: 1; }
    .htmx-request.htmx-indicator { opacity: 1; }
  </style>
</head>
<body class="dark bg-background text-foreground font-sans h-screen flex overflow-hidden selection:bg-primary/30">
  <div x-data="{ currentTable: null, pageSize: 25 }" class="flex h-screen w-full">
    <aside class="w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-20 shrink-0 text-sidebar-foreground">
      <div class="p-4 border-b border-sidebar-border flex items-center gap-3 bg-sidebar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
        <h1 class="text-sm font-semibold tracking-tight m-0">Bungres Studio</h1>
      </div>
      <div class="flex-1 overflow-y-auto p-2" hx-get="/htmx/sidebar" hx-trigger="load">
        <div class="p-4 text-xs text-muted-foreground animate-pulse text-center">Loading schemas...</div>
      </div>
    </aside>
    <main class="flex-1 flex flex-col relative w-[calc(100vw-16rem)]">
      <header class="h-14 px-4 border-b border-border flex items-center justify-between bg-card z-10 shrink-0 text-card-foreground">
        <h2 class="text-sm font-semibold tracking-tight flex items-center gap-2">
          <template x-if="currentTable">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </template>
          <template x-if="!currentTable">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </template>
          <span x-text="currentTable ? currentTable : 'Select a table'"></span>
        </h2>
        <button x-bind:disabled="!currentTable" class="bg-card border border-border text-card-foreground px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all hover:bg-accent hover:text-accent-foreground active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 group" x-on:click="$dispatch('refresh-table')">
          <svg class="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
      </header>
      <div class="flex-1 overflow-auto relative z-[1] text-left bg-background">
        <div id="data-container" class="h-full w-full flex flex-col" x-on:refresh-table.window="if(currentTable) htmx.ajax('GET', '/htmx/tables/' + currentTable + '?limit=' + pageSize, {target: '#data-container'})">
          <div class="flex flex-col items-center justify-center h-full w-full text-muted-foreground animate-[fadeIn_0.5s_ease-out]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-16 h-16 mb-4 text-muted">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <h3 class="text-foreground m-0 mb-2 text-lg">No Table Selected</h3>
            <p class="text-sm">Choose a table from the sidebar to view its data</p>
          </div>
        </div>
      </div>
    </main>
  </div>
  <script>
    document.addEventListener('alpine:init', () => {})
  </script>
</body>
</html>`;
