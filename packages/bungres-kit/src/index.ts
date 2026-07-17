// ---------------------------------------------------------------------------
// @bungres/kit — programmatic API (for use without the CLI)
// ---------------------------------------------------------------------------

export { loadConfig } from "./config.js";
export type { BungresKitConfig, ResolvedConfig } from "./config.js";

/** Identity helper for type-safe config — mirrors drizzle-kit's defineConfig */
export function defineConfig(config: import("./config.js").BungresKitConfig) {
  return config;
}

export { loadSchemas } from "./schema-loader.js";
export type { SchemaEntry } from "./schema-loader.js";

export { runPush } from "./commands/push.js";
export { runGenerate } from "./commands/generate.js";
export { runMigrate } from "./commands/migrate.js";
export { runPull } from "./commands/pull.js";
export { runStatus } from "./commands/status.js";
export { runDrop } from "./commands/drop.js";
