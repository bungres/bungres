import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// init — Initialize bungres project with config file and db folder structure
// ---------------------------------------------------------------------------

export async function runInit(cwd = process.cwd()): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit init ")));

  const configPath = join(cwd, "bungres.config.ts");
  const dbDir = join(cwd, "src", "db");

  // Check if config already exists
  if (existsSync(configPath)) {
    p.log.warn(pc.yellow("Config file already exists at bungres.config.ts"));
    p.outro("Failed.");
    return;
  }

  const s = p.spinner();
  s.start("Creating project structure...");

  // Create db directory structure
  try {
    await mkdir(dbDir, { recursive: true });
    p.log.step(`Created ${pc.cyan("src/db")} directory`);
  } catch (e) {
    s.stop("Failed");
    p.log.error(`Failed to create src/db directory: ${e}`);
    p.outro("Failed.");
    return;
  }

  // Create config file
  const configContent = `import { defineConfig } from "@bungres/kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
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
    p.log.step(`Created ${pc.cyan("src/db/schema.ts")} with example table`);
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
    p.log.step(`Created ${pc.cyan("src/db/client.ts")}`);
  } catch (e) {
    p.log.error(`Failed to create client file: ${e}`);
  }

  s.stop("Project initialized.");

  const nextSteps = `1. Set DATABASE_URL in your .env file
2. Edit src/db/schema.ts to define your tables
3. Run ${pc.green("bungres generate")} to create migrations
4. Run ${pc.green("bungres migrate")} to apply migrations`;

  p.note(nextSteps, "Next steps");
  p.outro(pc.cyan("✨ Bungres project initialized!"));
}
