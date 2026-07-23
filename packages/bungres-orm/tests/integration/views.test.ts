import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { bungres, generateCreateTable, generateCreateView, generateDropView, getTableConfig, integer, pgMaterializedView, pgTable, pgView, text, uuid } from "../../src/index.js";

const DB_URL = Bun.env.DATABASE_URL;

if (!DB_URL) {
  console.log("  ⚠  Skipping views tests — no DATABASE_URL set.");
}

const runTests = !!DB_URL;

if (runTests) {
  // Base table
  const salaries = pgTable("_bungres_test_salaries", {
    id: uuid("id", { primaryKey: true }),
    department: text("department"),
    amount: integer("amount"),
  });

  // Query config for views
  const queryConfig = {
    toSQL: () => ({
      sql: 'SELECT department, SUM(amount) AS total FROM "_bungres_test_salaries" GROUP BY department',
      params: [],
    })
  };

  const standardView = pgView("_bungres_test_view", queryConfig);
  const materializedView = pgMaterializedView("_bungres_test_mat_view", queryConfig);

  const db = bungres({ url: DB_URL });

  beforeAll(async () => {
    // Drop in reverse dependency order
    await db.raw(generateDropView(materializedView));
    await db.raw(generateDropView(standardView));
    await db.raw(`DROP TABLE IF EXISTS "_bungres_test_salaries"`);

    // Create table and populate
    await db.raw(generateCreateTable(getTableConfig(salaries)));
    await db.insert(salaries).values([
      { department: "IT", amount: 5000 },
      { department: "IT", amount: 6000 },
      { department: "HR", amount: 4000 },
    ]);

    // Create views
    await db.raw(generateCreateView(standardView));
    await db.raw(generateCreateView(materializedView));
  });

  afterAll(async () => {
    // await db.raw(generateDropView("_bungres_test_mat_view", { materialized: true }));
    // await db.raw(generateDropView("_bungres_test_view"));
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_test_salaries"`);
    await db.close();
  });

  describe("Views and Materialized Views", () => {
    it("selects from a standard view", async () => {
      const rows = await db.raw<{ department: string; total: string | number }>(
        `SELECT * FROM "_bungres_test_view" ORDER BY department`
      );

      expect(rows).toHaveLength(2);
      expect(rows[0]!.department).toBe("HR");
      expect(Number(rows[0]!.total)).toBe(4000);
      expect(rows[1]!.department).toBe("IT");
      expect(Number(rows[1]!.total)).toBe(11000);
    });

    it("selects from a materialized view", async () => {
      let rows = await db.raw<{ department: string; total: string | number }>(
        `SELECT * FROM "_bungres_test_mat_view" ORDER BY department`
      );
      expect(rows).toHaveLength(2);
      expect(Number(rows[1]!.total)).toBe(11000); // IT total initially

      // Insert new data
      await db.insert(salaries).values({ department: "IT", amount: 2000 });

      // Mat view should NOT be updated yet
      rows = await db.raw<{ department: string; total: string | number }>(
        `SELECT * FROM "_bungres_test_mat_view" ORDER BY department`
      );
      expect(Number(rows[1]!.total)).toBe(11000);

      // Refresh mat view
      await db.raw(`REFRESH MATERIALIZED VIEW "_bungres_test_mat_view"`);

      // Mat view should be updated now
      rows = await db.raw<{ department: string; total: string | number }>(
        `SELECT * FROM "_bungres_test_mat_view" ORDER BY department`
      );
      expect(Number(rows[1]!.total)).toBe(13000);
    });
  });
}
