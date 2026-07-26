import { baseOptions } from '@/lib/layout.shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import {
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  CheckCircle2,
  Copy,
  Layers,
  Pencil,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap
} from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'connect' | 'query' | 'cli'>('schema');

  const handleCopy = () => {
    navigator.clipboard.writeText('bun add @bungres/orm @bungres/kit');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <HomeLayout {...baseOptions()}>
      <div className="relative flex flex-col flex-1 overflow-hidden bg-fd-background text-fd-foreground">
        {/* Decorative Background Ambient Light Gradients */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-cyan-500/20 via-purple-500/20 to-pink-500/10 blur-[120px] rounded-full opacity-60 dark:opacity-40" />

        {/* HERO SECTION */}
        <section className="relative px-6 pt-16 pb-20 max-w-6xl mx-auto text-center flex flex-col items-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-medium text-xs sm:text-sm mb-6 shadow-sm shadow-cyan-500/10 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
            <span>Bun-Native Postgres ORM v1.2.1 &amp; Kit v2.0.0</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-[1.1] mb-6">
            Type-Safe Postgres ORM <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500 bg-clip-text text-transparent">
              Built Natively for Bun
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-fd-muted-foreground max-w-2xl font-normal leading-relaxed mb-10">
            Powered directly by <code className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 font-mono text-sm font-semibold">Bun.SQL</code> — zero external driver overhead, ultra-fast queries, automatic casing transformations, and automated migrations.
          </p>

          {/* CTA Group */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link
              to="/docs/$"
              params={{ _splat: '' }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <BookOpen className="w-4 h-4" />
              <span>Read Documentation</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-3 px-4 py-3 rounded-xl border border-fd-border bg-fd-card hover:bg-fd-accent text-fd-card-foreground font-mono text-sm shadow-sm transition-all"
            >
              <Terminal className="w-4 h-4 text-cyan-500" />
              <span>bun add @bungres/orm</span>
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500 ml-1" />
              ) : (
                <Copy className="w-4 h-4 text-fd-muted-foreground ml-1" />
              )}
            </button>
          </div>

          {/* CODE PREVIEW WINDOW */}
          <div className="w-full max-w-4xl rounded-2xl border border-fd-border/70 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden text-left">
            {/* Window Topbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="text-xs text-slate-400 font-mono ml-2">bungres-demo.ts</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('schema')}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${activeTab === 'schema'
                      ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  schema.ts
                </button>
                <button
                  onClick={() => setActiveTab('connect')}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${activeTab === 'connect'
                      ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  db.ts
                </button>
                <button
                  onClick={() => setActiveTab('query')}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${activeTab === 'query'
                      ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  query.ts
                </button>
                <button
                  onClick={() => setActiveTab('cli')}
                  className={`px-3 py-1 text-xs font-mono rounded-md transition-colors ${activeTab === 'cli'
                      ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  cli.sh
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div className="p-6 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto min-h-[220px]">
              {activeTab === 'schema' && (
                <pre className="text-slate-200">
                  <code>{`import { pgTable, uuid, varchar, text, boolean, timestamptz } from "@bungres/orm";

export const users = pgTable("users", {
  id: uuid({ primaryKey: true }),
  email: varchar({ length: 255, notNull: true, unique: true }),
  fullName: text(), // Automatically maps to 'full_name' column!
  active: boolean({ default: true, notNull: true }),
  createdAt: timestamptz({ defaultRaw: "NOW()", notNull: true }),
});`}</code>
                </pre>
              )}

              {activeTab === 'connect' && (
                <pre className="text-slate-200">
                  <code>{`import { bungres } from "@bungres/orm";

// Powered by native Bun.SQL — zero external driver packages needed!
export const db = bungres(process.env.DATABASE_URL!);`}</code>
                </pre>
              )}

              {activeTab === 'query' && (
                <pre className="text-slate-200">
                  <code>{`import { db } from "./db";
import { users } from "./schema";
import { eq } from "@bungres/orm";

// Execute type-safe select queries
const user = await db
  .select()
  .from(users)
  .where(eq(users.email, "alice@example.com"))
  .single();

// Fully inferred result shape: User | null`}</code>
                </pre>
              )}

              {activeTab === 'cli' && (
                <pre className="text-slate-200">
                  <code>{`# Push schema straight to DB for rapid prototyping
bun run bungres push

# Or generate versioned timestamped migration files & run them
bun run bungres generate
bun run bungres migrate

# Launch local Web Studio data browser
bun run bungres studio`}</code>
                </pre>
              )}
            </div>
          </div>
        </section>

        {/* FEATURES GRID SECTION */}
        <section className="relative px-6 py-20 bg-fd-card/50 border-y border-fd-border/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Everything You Need for High-Speed Postgres
              </h2>
              <p className="text-fd-muted-foreground max-w-xl mx-auto text-base">
                Engineered from the ground up for Bun's modern JavaScript runtime.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-6 rounded-2xl border border-fd-border bg-fd-card hover:border-cyan-500/50 transition-all shadow-sm hover:shadow-cyan-500/5 group">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Native Bun.SQL Engine</h3>
                <p className="text-fd-muted-foreground text-sm leading-relaxed">
                  Uses Bun's built-in C++ PostgreSQL driver directly. No intermediate bindings, zero driver overhead, and native connection pooling.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-2xl border border-fd-border bg-fd-card hover:border-cyan-500/50 transition-all shadow-sm hover:shadow-cyan-500/5 group">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">End-to-End Type Safety</h3>
                <p className="text-fd-muted-foreground text-sm leading-relaxed">
                  TypeScript types automatically infer row shapes for selections (<code className="text-xs">InferTable</code>) and insert payloads (<code className="text-xs">InferInsert</code>).
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-2xl border border-fd-border bg-fd-card hover:border-cyan-500/50 transition-all shadow-sm hover:shadow-cyan-500/5 group">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Pencil className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Automatic Casing API</h3>
                <p className="text-fd-muted-foreground text-sm leading-relaxed">
                  Map JavaScript <code className="text-xs">camelCase</code> properties to PostgreSQL <code className="text-xs">snake_case</code> columns automatically without writing repetitive strings.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-2xl border border-fd-border bg-fd-card hover:border-cyan-500/50 transition-all shadow-sm hover:shadow-cyan-500/5 group">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Zero-Boilerplate Relations</h3>
                <p className="text-fd-muted-foreground text-sm leading-relaxed">
                  Relational queries (<code className="text-xs">db.users.findMany</code>) automatically discover junction tables for Many-to-Many relations based on foreign keys.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-2xl border border-fd-border bg-fd-card hover:border-cyan-500/50 transition-all shadow-sm hover:shadow-cyan-500/5 group">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Terminal className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">CLI Toolkit (`@bungres/kit`)</h3>
                <p className="text-fd-muted-foreground text-sm leading-relaxed">
                  Generate migration SQL files, push schema in dev, introspect databases (<code className="text-xs">pull</code>), browse data in Studio, and debug in REPL.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-2xl border border-fd-border bg-fd-card hover:border-cyan-500/50 transition-all shadow-sm hover:shadow-cyan-500/5 group">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Braces className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">JSONB & Array Helpers</h3>
                <p className="text-fd-muted-foreground text-sm leading-relaxed">
                  Specialized condition operators for JSONB containment (<code className="text-xs">containsJson</code>) and array overlap checks (<code className="text-xs">arrayOverlaps</code>).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON / ARCHITECTURE SECTION */}
        <section className="px-6 py-20 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Why Bungres?</h2>
            <p className="text-fd-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
              Comparing native Bun integration vs traditional Node.js ORM stack.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Bungres Box */}
            <div className="p-6 sm:p-8 rounded-2xl border border-cyan-500/40 bg-cyan-500/5 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-cyan-500 text-white">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold">Bungres ORM</h3>
              </div>

              <ul className="space-y-3.5 text-sm">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Native Bun.SQL</strong>: Zero third-party driver npm dependencies</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Automatic Casing</strong>: JS camelCase to DB snake_case with 0 boilerplate</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Zero-Config Many-to-Many</strong>: Automatic foreign key junction detection</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
                  <span><strong>Integrated Toolkit</strong>: Studio GUI + Tusky REPL + Migrations in one package</span>
                </li>
              </ul>
            </div>

            {/* Traditional ORM Box */}
            <div className="p-6 sm:p-8 rounded-2xl border border-fd-border bg-fd-card/40 opacity-80">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-fd-muted text-fd-muted-foreground">
                  <Server className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-fd-muted-foreground">Traditional ORMs</h3>
              </div>

              <ul className="space-y-3.5 text-sm text-fd-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✕</span>
                  <span>Requires heavy node-pg or postgres.js driver wrappers</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✕</span>
                  <span>Requires typing column names twice for every table property</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✕</span>
                  <span>Requires manual 30-line many-to-many relation configuration blocks</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✕</span>
                  <span>Heavy memory footprint and external CLI dependencies</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA SECTION */}
        <section className="px-6 py-20 text-center relative border-t border-fd-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-6">
              Build Ultra-Fast Bun Apps Today
            </h2>
            <p className="text-fd-muted-foreground text-base sm:text-lg mb-8">
              Get started with Bungres ORM and Bungres Kit CLI in less than 5 minutes.
            </p>
            <Link
              to="/docs/$"
              params={{ _splat: '' }}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-semibold text-base shadow-xl shadow-cyan-500/25 transition-all hover:scale-105"
            >
              <span>Explore Documentation</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </div>
    </HomeLayout>
  );
}
