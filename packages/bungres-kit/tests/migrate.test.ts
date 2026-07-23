import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { runMigrate } from "../src/commands/migrate.js";
import { runStatus } from "../src/commands/status.js";
import { runRollback } from "../src/commands/rollback.js";
import { runRefresh } from "../src/commands/refresh.js";
import type { ResolvedConfig } from "../src/config.js";

const mockConfig = (outPath: string): ResolvedConfig => ({
  schema: "src/db/schema.ts",
  seed: "src/db/seed.ts",
  out: outPath,
  dbUrl: "postgres://localhost:5432/mock_db",
  dbSchema: "public",
  migrationsTable: "__bungres_migrations",
  migrationsSchema: "bungres",
  breakpoints: true,
  strict: false,
  outDir: "./src/db/generated",
  verbose: false,
});

describe("Migration Commands Folder & File Handling", () => {
  it("runMigrate handles missing directory gracefully without throwing ENOENT", async () => {
    const nonExistentDir = resolve("./non_existent_migrations_dir_test_12345");
    const config = mockConfig(nonExistentDir);

    await expect(runMigrate(config)).resolves.toBeUndefined();
  });

  it("runStatus handles missing directory gracefully without throwing ENOENT", async () => {
    const nonExistentDir = resolve("./non_existent_migrations_dir_test_12345");
    const config = mockConfig(nonExistentDir);

    await expect(runStatus(config)).resolves.toBeUndefined();
  });

  it("runRollback handles missing directory gracefully without throwing ENOENT", async () => {
    const nonExistentDir = resolve("./non_existent_migrations_dir_test_12345");
    const config = mockConfig(nonExistentDir);

    await expect(runRollback(config)).resolves.toBeUndefined();
  });

  it("runRefresh handles missing directory gracefully without throwing ENOENT", async () => {
    const nonExistentDir = resolve("./non_existent_migrations_dir_test_12345");
    const config = mockConfig(nonExistentDir);

    await expect(runRefresh(config)).resolves.toBeUndefined();
  });

  it("runMigrate handles path when it is a file instead of a directory", async () => {
    const filePath = resolve("./package.json");
    const config = mockConfig(filePath);

    await expect(runMigrate(config)).resolves.toBeUndefined();
  });
});
