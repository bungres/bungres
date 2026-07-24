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
export type { SchemaEntry, TableSchemaEntry, EnumSchemaEntry, ViewSchemaEntry } from "./schema-loader.js";

export { diffSchemas, topoSortConfigs } from "./differ.js";
export type { SchemaSnapshot, DiffResult } from "./differ.js";

export { introspectDb } from "./commands/pull.js";
export type { TableInfo } from "./commands/pull.js";

export { splitSqlStatements } from "./sql-splitter.js";

export { defineSeed, TableBlueprint, createFakeGenerator, executeSeedDefinition } from "./seeder.js";
export type { SeedDefinition, SeedHelpers, FakeGenerator, RelGenerator } from "./seeder.js";

// Commands
export { runCheck } from "./commands/check.js";
export { runGenerate } from "./commands/generate.js";
export { runMigrate } from "./commands/migrate.js";
export { runRollback } from "./commands/rollback.js";
export { runPush } from "./commands/push.js";
export { runPull } from "./commands/pull.js";
export { runStatus } from "./commands/status.js";
export { runFresh } from "./commands/fresh.js";
export { runRefresh } from "./commands/refresh.js";
export { runSeed } from "./commands/seed.js";
export { runStudio } from "./commands/studio.js";
export { runTusky } from "./commands/tusky.js";
export { runDrop } from "./commands/drop.js";
export { runInit } from "./commands/init.js";
