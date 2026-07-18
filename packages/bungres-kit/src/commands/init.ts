import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// init — Initialize bungres project with config file and db folder structure
// ---------------------------------------------------------------------------

export async function runInit(cwd = process.cwd()): Promise<void> {
  const configPath = join(cwd, "bungres.config.ts");
  const dbDir = join(cwd, "src", "db");

  // Check if config already exists
  if (existsSync(configPath)) {
    console.log("Config file already exists at bungres.config.ts");
    return;
  }

  // Create db directory structure
  try {
    await mkdir(dbDir, { recursive: true });
    console.log("Created src/db directory");
  } catch (e) {
    console.error("Failed to create src/db directory:", e);
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
    console.log("Created bungres.config.ts");
  } catch (e) {
    console.error("Failed to create config file:", e);
    return;
  }

  // Create schema.ts file
  const schemaContent = `import {
  uuid,
  varchar,
  timestamptz,
  table,
  unique,
  index
} from "@bungres/orm";

export const users = table("users", {
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
    console.log("Created src/db/schema.ts with example table");
  } catch (e) {
    console.error("Failed to create schema file:", e);
  }

  // Create client.ts file
  const clientContent = `import { bungres } from "@bungres/orm";
import * as schema from "./schema";

const url = Bun.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";

export const db = bungres({ url, schema });
`;

  try {
    await Bun.write(join(dbDir, "client.ts"), clientContent);
    console.log("Created src/db/client.ts");
  } catch (e) {
    console.error("Failed to create client file:", e);
  }

  console.log("\n✨ Bungres project initialized!");
  console.log("\nNext steps:");
  console.log("  1. Set DATABASE_URL in your .env file");
  console.log("  2. Edit src/db/schema.ts to define your tables");
  console.log("  3. Run 'bungres generate' to create migrations");
  console.log("  4. Run 'bungres migrate' to apply migrations");
}
