import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { bungres, generateCreateEnum, generateCreateTable, generateDropEnum, getTableConfig, pgEnum, pgTable, uuid } from "../../src/index.js";

const DB_URL = Bun.env.DATABASE_URL;

if (!DB_URL) {
  console.log("  ⚠  Skipping enums tests — no DATABASE_URL set.");
}

const runTests = !!DB_URL;

if (runTests) {
  const statusEnum = pgEnum("_bungres_test_status", ["active", "pending", "archived"]);

  const enumTable = pgTable("_bungres_test_enums", {
    id: uuid("id", { primaryKey: true }),
    status: statusEnum("status"),
  });

  const db = bungres({ url: DB_URL });

  beforeAll(async () => {
    await db.raw(`DROP TABLE IF EXISTS "_bungres_test_enums"`);
    await db.raw(generateDropEnum("_bungres_test_status"));
    await db.raw(generateCreateEnum("_bungres_test_status", ["active", "pending", "archived"]));
    await db.raw(generateCreateTable(getTableConfig(enumTable)));
  });

  afterAll(async () => {
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_test_enums"`);
    // await db.raw(generateDropEnum(statusEnum));
    await db.close();
  });

  describe("Enums", () => {
    it("inserts and retrieves enum values correctly", async () => {
      const inserted = await db.insert(enumTable).values({
        status: "active",
      }).returning();

      expect(inserted).toHaveLength(1);
      expect(inserted[0]!.status).toBe("active");
    });

    it("throws an error when inserting an invalid enum value", async () => {
      try {
        await db.insert(enumTable).values({
          status: "invalid_status" as any,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (err: any) {
        expect(err.message).toContain("invalid input value for enum _bungres_test_status");
      }
    });
  });
}
