import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadMigrationFolders, loadLatestSnapshotFromFolders } from "../src/migration-loader.js";

describe("Migration Folder Loader", () => {
  test("loads migration folders containing up.sql, down.sql, and snapshot.json", async () => {
    const tmpDir = join(process.cwd(), `tmp_mig_test_${Date.now()}`);
    const folder1 = join(tmpDir, "2026_07_21_000000_init");
    const folder2 = join(tmpDir, "2026_07_24_000000_add_views");

    await Bun.$`mkdir -p ${folder1}`.quiet();
    await Bun.$`mkdir -p ${folder2}`.quiet();

    await Bun.write(join(folder1, "up.sql"), "CREATE TABLE users (id int);");
    await Bun.write(join(folder1, "down.sql"), "DROP TABLE users;");
    await Bun.write(join(folder1, "snapshot.json"), JSON.stringify({ tables: { users: {} } }));

    await Bun.write(join(folder2, "up.sql"), "CREATE VIEW v1 AS SELECT 1;");
    await Bun.write(join(folder2, "down.sql"), "DROP VIEW v1;");
    await Bun.write(join(folder2, "snapshot.json"), JSON.stringify({ tables: { users: {} }, views: { v1: {} } }));

    const folders = await loadMigrationFolders(tmpDir);
    expect(folders.length).toBe(2);
    expect(folders[0]!.name).toBe("2026_07_21_000000_init");
    expect(folders[0]!.upContent).toContain("CREATE TABLE users");
    expect(folders[0]!.downContent).toContain("DROP TABLE users");
    expect(folders[0]!.snapshot?.tables.users).toBeDefined();

    expect(folders[1]!.name).toBe("2026_07_24_000000_add_views");

    const latestSnap = await loadLatestSnapshotFromFolders(tmpDir);
    expect(latestSnap?.views?.v1).toBeDefined();

    await Bun.$`rm -rf ${tmpDir}`.quiet();
  });

  test("runGenerate creates migration folder containing up.sql, down.sql, and snapshot.json", async () => {
    const tmpDir = join(process.cwd(), `tmp_gen_test_${Date.now()}`);
    const config: any = {
      schema: "tests/fixtures/sample-schema.ts",
      out: tmpDir,
      dbUrl: "postgres://localhost:5432/mock_db",
      migrationsTable: "__bungres_migrations",
      migrationsSchema: "bungres",
    };

    // Create fixture schema file
    const fixturePath = join(process.cwd(), "tests/fixtures/sample-schema.ts");
    await Bun.$`mkdir -p ${join(process.cwd(), "tests/fixtures")}`.quiet();
    await Bun.write(fixturePath, `
      import { pgTable, uuid, varchar } from "@bungres/orm";
      export const users = pgTable("users", {
        id: uuid("id"),
        name: varchar("name"),
      });
    `);

    const { runGenerate } = await import("../src/commands/generate.js");
    await runGenerate(config, "create_users", { yes: true });

    const folders = await loadMigrationFolders(tmpDir);
    expect(folders.length).toBe(1);
    expect(folders[0]!.name).toContain("create_users");
    expect(folders[0]!.upContent).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(folders[0]!.downContent).toContain('DROP TABLE IF EXISTS "users"');
    expect(folders[0]!.snapshot?.tables.users).toBeDefined();

    await Bun.$`rm -rf ${tmpDir} ${join(process.cwd(), "tests/fixtures")}`.quiet();
  });
});
