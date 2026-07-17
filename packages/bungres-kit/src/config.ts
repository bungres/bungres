import { resolve, join } from "node:path";

// ---------------------------------------------------------------------------
// Config — mirrors drizzle-kit's config shape, adapted for bungres
// ---------------------------------------------------------------------------

export interface BungresKitConfig {
  /**
   * Glob pattern(s) pointing to your schema file(s).
   * e.g. "./src/db/schema.ts" or "./src/db/schema/index.ts"
   */
  schema: string | string[];

  /**
   * Path to the seed file to execute with `bungres seed`.
   * e.g. "./src/db/seed.ts"
   */
  seed?: string;

  /**
   * Output directory for generated migration .sql files.
   * Equivalent to drizzle's `out`. Default: "./migrations"
   */
  out?: string;

  /**
   * Postgres connection credentials.
   * URL can also come from the DATABASE_URL environment variable.
   */
  dbCredentials?: {
    url: string;
  };

  /**
   * Postgres schema name to introspect with `bungres pull`.
   * Default: "public"
   */
  dbSchema?: string;

  /** Print every SQL statement executed. Default: false */
  verbose?: boolean;
}

export interface ResolvedConfig {
  schema: string | string[];
  seed: string;
  out: string;
  dbUrl: string;
  dbSchema: string;
  /** @deprecated use out — kept internally for compat */
  migrationsDir: string;
  outDir: string;
  verbose: boolean;
}

const CONFIG_FILES = [
  "bungres.config.ts",
  "bungres.config.js",
  "bungres.config.mts",
  "bungres.config.mjs",
];

export async function loadConfig(cwd = process.cwd()): Promise<ResolvedConfig> {
  let userConfig: Partial<BungresKitConfig> = {};

  for (const file of CONFIG_FILES) {
    const configPath = join(cwd, file);
    if (await Bun.file(configPath).exists()) {
      const mod = await import(resolve(configPath));
      userConfig = mod.default ?? mod;
      break;
    }
  }

  const dbUrl =
    userConfig.dbCredentials?.url ??
    process.env["DATABASE_URL"] ??
    process.env["POSTGRES_URL"] ??
    "";

  if (!dbUrl) {
    console.error(
      "bungres: No database URL found.\n" +
      "  Add dbCredentials.url to bungres.config.ts  or set DATABASE_URL."
    );
    process.exit(1);
  }

  const out = userConfig.out ?? "./migrations";

  return {
    schema: userConfig.schema ?? "src/db/schema/**/*.ts",
    seed: userConfig.seed ?? "src/db/seed.ts",
    out,
    dbUrl,
    dbSchema: userConfig.dbSchema ?? "public",
    // internal aliases kept so commands don't need changing
    migrationsDir: out,
    outDir: "./src/db/generated",
    verbose: userConfig.verbose ?? false,
  };
}
