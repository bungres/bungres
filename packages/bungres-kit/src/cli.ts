#!/usr/bin/env bun
// ---------------------------------------------------------------------------
// @bungres/kit CLI — entry point
// Usage: bungres <command> [options]
// ---------------------------------------------------------------------------

import pc from "picocolors";
import { runCheck } from "./commands/check.js";
import { runDrop } from "./commands/drop.js";
import { runFresh } from "./commands/fresh.js";
import { runGenerate } from "./commands/generate.js";
import { runInit } from "./commands/init.js";
import { runMigrate } from "./commands/migrate.js";
import { runPull } from "./commands/pull.js";
import { runPush } from "./commands/push.js";
import { runRefresh } from "./commands/refresh.js";
import { runRollback } from "./commands/rollback.js";
import { runSeed } from "./commands/seed.js";
import { runStatus } from "./commands/status.js";
import { runStudio } from "./commands/studio.js";
import { runTusky } from "./commands/tusky.js";
import { loadConfig } from "./config.js";
import { ensureDatabase } from "./ensure-db.js";

import pkg from "../package.json";

const VERSION = pkg.version;

const HELP = `
${pc.cyan("🐘 Bungres ORM CLI")} v${VERSION}

${pc.yellow("Usage:")}
  bungres <command> [options]

${pc.yellow("Commands:")}
  init          Initialize bungres project with config file and db folder structure
  check         Check for ungenerated schema changes or pending DB migrations (CI tool)
  generate      Generate SQL migration files from your schema definitions
  migrate       Run pending migration files against the database
  rollback      Revert the last applied migration
  push          Apply schema directly to the DB (no migration files, dev mode)
  pull          Introspect the database and generate TypeScript schema
  status        Show applied vs. pending migrations
  fresh         Drop all tables and re-run all migrations from scratch
  refresh       Truncate all tables to quickly reset data without dropping schema
  seed          Execute the seed script to populate the database
  studio        Start a local web interface to browse database data
  tusky         Boot up a Node REPL connected to the database with schema loaded
  drop          Drop all tables defined in the schema (dev only)

${pc.yellow("Options:")}
  -c, --config  Path to config file (default: bungres.config.ts)
  -v, --verbose Enable verbose SQL logging
  -y, --yes     Bypass confirmation prompts (non-interactive mode)
  -f, --force   Skip confirmation prompts (use with drop)
  --version     Show version
  -h, --help    Show this help

${pc.yellow("Examples:")}
  bungres init
  bungres check
  bungres generate --yes
  bungres migrate
  bungres rollback
  bungres push --yes
  bungres pull
  bungres status
  bungres fresh
  bungres refresh
  bungres seed
  bungres studio
  bungres tusky
  bungres drop -f
`.trim();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`@bungres/kit v${VERSION}`);
    process.exit(0);
  }

  const command = args[0];
  const flags = parseFlags(args.slice(1));

  // Handle init separately since it doesn't need config
  if (command === "init") {
    await runInit();
    process.exit(0);
  }

  const configPath = typeof flags.config === "string" ? flags.config : undefined;
  const config = await loadConfig(process.cwd(), configPath);

  // Override verbose from flag
  if (flags.verbose) config.verbose = true;

  if (command && ["migrate", "rollback", "push", "drop", "status", "fresh", "refresh"].includes(command)) {
    await ensureDatabase(config.dbUrl);
  }

  const isForceOrYes = !!(flags.force || flags.yes);

  switch (command) {
    case "check": {
      const ok = await runCheck(config, { checkDb: true });
      process.exit(ok ? 0 : 1);
      break;
    }

    case "generate":
      await runGenerate(config, flags.name as string | undefined, { yes: isForceOrYes });
      break;

    case "migrate":
      await runMigrate(config);
      break;

    case "rollback":
      await runRollback(config);
      break;

    case "push":
      await runPush(config, { force: isForceOrYes });
      break;

    case "pull":
      await runPull(config);
      break;

    case "status":
      await runStatus(config);
      break;

    case "drop":
      await runDrop(config, { force: isForceOrYes });
      break;

    case "fresh":
      await runFresh(config);
      break;

    case "refresh":
      await runRefresh(config);
      break;

    case "seed":
      await runSeed(config);
      break;

    case "studio":
      await runStudio(config);
      break;

    case "tusky":
      await runTusky(config);
      break;

    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

export function parseFlags(args: string[]): Record<string, boolean | string> {
  const flags: Record<string, boolean | string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      let fullKey = key;
      if (key === "y") fullKey = "yes";
      else if (key === "v") fullKey = "verbose";
      else if (key === "c") fullKey = "config";
      else if (key === "f") fullKey = "force";
      else if (key === "h") fullKey = "help";

      const next = args[i + 1];
      if (next && !next.startsWith("-") && (fullKey === "config" || fullKey === "name")) {
        flags[fullKey] = next;
        i++;
      } else {
        flags[fullKey] = true;
      }
    }
  }
  return flags;
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("@bungres/kit error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
