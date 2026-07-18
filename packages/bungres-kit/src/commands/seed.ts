import { resolve } from "node:path";
import type { ResolvedConfig } from "../config.js";
import { colorize } from "../utils/colors.js";

// ---------------------------------------------------------------------------
// seed — execute a seed script to populate the database
// ---------------------------------------------------------------------------

export async function runSeed(config: ResolvedConfig): Promise<void> {
  if (!config.seed) {
    console.log(colorize(`No seed file configured in bungres.config.ts`, "yellow"));
    return;
  }

  const seedPath = resolve(process.cwd(), config.seed);

  const file = Bun.file(seedPath);
  if (!(await file.exists())) {
    console.error(colorize(`Seed file not found at ${seedPath}`, "red"));
    process.exit(1);
  }

  console.log(colorize(`\nRunning seeder: ${config.seed}...`, "cyan"));

  // Run the seed script in a new process to ensure a clean state
  const proc = Bun.spawn(["bun", "run", seedPath], {
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
    env: { ...Bun.env, DATABASE_URL: config.dbUrl } // Pass dbUrl implicitly just in case
  });

  const exitCode = await proc.exited;

  if (exitCode === 0) {
    console.log("\nSeed complete.");
  } else {
    console.error(`\nSeed failed with exit code ${exitCode}.`);
    process.exit(exitCode);
  }
}
