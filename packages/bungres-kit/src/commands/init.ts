import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// init — Initialize bungres project with config file and db folder structure
// ---------------------------------------------------------------------------

export async function runInit(cwd = process.cwd()): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit init ")));

  const configPath = join(cwd, "bungres.config.ts");

  // Check if config already exists
  if (existsSync(configPath)) {
    p.log.warn(pc.yellow("Config file already exists at bungres.config.ts"));
    p.outro("Failed.");
    return;
  }

  let shouldPrompt = true;
  const defaultDbDir = "src/db";

  if (existsSync(join(cwd, "src"))) {
    if (!existsSync(join(cwd, defaultDbDir, "schema.ts")) && !existsSync(join(cwd, defaultDbDir, "client.ts"))) {
      shouldPrompt = false;
    }
  }

  let dbDirInput: string | symbol = defaultDbDir;

  if (shouldPrompt) {
    dbDirInput = await p.text({
      message: "Where would you like to initialize the database files?",
      placeholder: defaultDbDir,
      defaultValue: defaultDbDir,
    });

    if (p.isCancel(dbDirInput)) {
      p.outro(pc.gray("Initialization cancelled."));
      return;
    }
  }

  const dbDirRel = (dbDirInput as string).replace(/^(\.\/|\/+)/, ''); // remove leading ./ or /
  const dbDir = join(cwd, dbDirRel);

  const s = p.spinner();
  s.start("Creating project structure...");

  // Create db directory structure
  try {
    await mkdir(dbDir, { recursive: true });
    p.log.step(`Created ${pc.cyan(dbDirRel)} directory`);
  } catch (e) {
    s.stop("Failed");
    p.log.error(`Failed to create ${dbDirRel} directory: ${e}`);
    p.outro("Failed.");
    return;
  }

  // Create config file
  const configContent = `import { defineConfig } from "@bungres/kit";

export default defineConfig({
  schema: "./${dbDirRel}/schema.ts",
  out: "./bungres",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`;

  try {
    await Bun.write(configPath, configContent);
    p.log.step(`Created ${pc.cyan("bungres.config.ts")}`);
  } catch (e) {
    s.stop("Failed");
    p.log.error(`Failed to create config file: ${e}`);
    p.outro("Failed.");
    return;
  }

  // Create schema.ts file
  const schemaContent = `import {
  uuid,
  varchar,
  timestamptz,
  pgTable,
  unique,
  index
} from "@bungres/orm";

export const users = pgTable("users", {
  id: uuid({ primaryKey: true }),
  name: varchar({ length: 255, notNull: true }),
  email: varchar({ length: 255, notNull: true }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
}, (t) => [
  unique().on(t.email),
  index().on(t.email),
]);
`;

  try {
    await Bun.write(join(dbDir, "schema.ts"), schemaContent);
    p.log.step(`Created ${pc.cyan(`${dbDirRel}/schema.ts`)} with example table`);
  } catch (e) {
    p.log.error(`Failed to create schema file: ${e}`);
  }

  // Create client.ts file
  const clientContent = `import { bungres } from "@bungres/orm";
import * as schema from "./schema";

const url = Bun.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";

export const db = bungres({ url, schema });
`;

  try {
    await Bun.write(join(dbDir, "client.ts"), clientContent);
    p.log.step(`Created ${pc.cyan(`${dbDirRel}/client.ts`)}`);
  } catch (e) {
    p.log.error(`Failed to create client file: ${e}`);
  }

  s.stop("Project initialized.");

  const nextSteps = `1. Set DATABASE_URL in your .env file
2. Edit ${dbDirRel}/schema.ts to define your tables
3. Run ${pc.green("bungres generate")} to create migrations
4. Run ${pc.green("bungres migrate")} to apply migrations`;

  p.note(nextSteps, "Next steps");
  p.outro(pc.cyan("✨ Bungres project initialized!"));
}
