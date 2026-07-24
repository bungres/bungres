import { describe, expect, test } from "bun:test";
import { runCheck } from "../src/commands/check.js";
import type { ResolvedConfig } from "../src/config.js";

describe("runCheck command", () => {
  test("returns false when no schemas are found", async () => {
    const mockConfig: ResolvedConfig = {
      schema: "non_existent_path_12345/*.ts",
      seed: "src/db/seed.ts",
      out: "./migrations",
      dbUrl: "postgres://localhost:5432/test",
      dbSchema: "public",
      migrationsTable: "__bungres_migrations",
      migrationsSchema: "bungres",
      breakpoints: true,
      strict: false,
      outDir: "./src/db/generated",
      verbose: false,
    };

    const isClean = await runCheck(mockConfig, { checkDb: false });
    expect(isClean).toBe(false);
  });
});
