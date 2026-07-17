import type { ResolvedConfig } from "../config.js";
import { runDrop } from "./drop.js";
import { runMigrate } from "./migrate.js";

// ---------------------------------------------------------------------------
// fresh — drop all tables and re-run all migrations from scratch
// ---------------------------------------------------------------------------

export async function runFresh(config: ResolvedConfig): Promise<void> {
  console.log("Dropping all tables...");
  await runDrop(config, { force: true });
  
  console.log("\nRe-running migrations...");
  await runMigrate(config);
  
  console.log("\nFresh complete.");
}
