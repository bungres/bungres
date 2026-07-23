import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { avg, bungres, count, eq, generateCreateTable, getTableConfig, integer, max, min, pgTable, sum, uuid } from "../../src/index.js";

const DB_URL = Bun.env.DATABASE_URL;

if (!DB_URL) {
  console.log("  ⚠  Skipping aggregations tests — no DATABASE_URL set.");
}

const runTests = !!DB_URL;

if (runTests) {
  const orders = pgTable("_bungres_test_orders", {
    id: uuid("id", { primaryKey: true }),
    userId: integer("user_id"),
    amount: integer("amount"),
  });

  const db = bungres({ url: DB_URL });

  beforeAll(async () => {
    await db.raw(`DROP TABLE IF EXISTS "_bungres_test_orders"`);
    await db.raw(generateCreateTable(getTableConfig(orders)));
    await db.insert(orders).values([
      { userId: 1, amount: 100 },
      { userId: 1, amount: 200 },
      { userId: 2, amount: 50 },
      { userId: 2, amount: 150 },
      { userId: 3, amount: 500 },
    ]);
  });

  afterAll(async () => {
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_test_orders"`);
    await db.close();
  });

  describe("Aggregations", () => {
    it("computes count", async () => {
      const res = await db.select({ c: count() }).from(orders);
      expect(Number(res[0]!.c)).toBe(5);
    });

    it("computes sum", async () => {
      const res = await db.select({ total: sum(orders.amount) }).from(orders);
      expect(Number(res[0]!.total)).toBe(1000);
    });

    it("computes avg", async () => {
      const res = await db.select({ average: avg(orders.amount) }).from(orders).where(eq(orders.userId, 1));
      expect(Number(res[0]!.average)).toBe(150);
    });

    it("computes min", async () => {
      const res = await db.select({ min_val: min(orders.amount) }).from(orders);
      expect(Number(res[0]!.min_val)).toBe(50);
    });

    it("computes max", async () => {
      const res = await db.select({ max_val: max(orders.amount) }).from(orders);
      expect(Number(res[0]!.max_val)).toBe(500);
    });
  });
}
