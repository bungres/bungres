import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { bungres, bytea, date, decimal, generateCreateTable, getTableConfig, integer, json, jsonb, numeric, pgTable, text, time, uuid } from "../../src/index.js";

const DB_URL = Bun.env.DATABASE_URL;

if (!DB_URL) {
  console.log("  ⚠  Skipping types tests — no DATABASE_URL set.");
}

const runTests = !!DB_URL;

if (runTests) {
  const allTypesTable = pgTable("_bungres_test_types", {
    id: uuid("id", { primaryKey: true }),
    jsonData: json("json_data"),
    jsonbData: jsonb("jsonb_data"),
    dateData: date("date_data"),
    timeData: time("time_data"),
    textArray: text("text_array").array(),
    intArray: integer("int_array").array(),
    decimalData: decimal("decimal_data"),
    numericData: numeric("numeric_data"),
    byteaData: bytea("bytea_data"),
  });

  const db = bungres({ url: DB_URL });

  beforeAll(async () => {
    await db.raw(`DROP TABLE IF EXISTS "_bungres_test_types"`);
    await db.raw(generateCreateTable(getTableConfig(allTypesTable)));
  });

  afterAll(async () => {
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_test_types"`);
    await db.close();
  });

  describe("Data Types", () => {
    it("inserts and retrieves various data types correctly", async () => {
      const inserted = await db.insert(allTypesTable).values({
        jsonData: { key: "value" },
        jsonbData: { arr: [1, 2, 3] },
        dateData: "2024-01-01" as any,
        timeData: "14:30:00" as any,
        textArray: "{apple,banana}" as any,
        intArray: "{4,5,6}" as any,
        decimalData: 10.5,
        numericData: 99.99,
        // byteaData: Buffer.from("hello world"),
      }).returning();

      expect(inserted).toHaveLength(1);
      const row = inserted[0]!;

      expect(row.jsonData).toEqual({ key: "value" });
      expect(row.jsonbData).toEqual({ arr: [1, 2, 3] });
      // Date may be returned as a string or Date object depending on the driver parsing
      expect(new Date(row.dateData as any).toISOString().startsWith("2024-01-01")).toBe(true);
      expect(row.timeData as any).toBe("14:30:00");
      expect(row.textArray).toEqual(["apple", "banana"]);
      expect(Array.from(row.intArray as any)).toEqual([4, 5, 6]);
      // decimal/numeric might be returned as strings by postgres driver to avoid precision loss
      expect(Number(row.decimalData)).toBe(10.5);
      expect(Number(row.numericData)).toBe(99.99);
      // const parsedBytea = typeof row.byteaData === "string" ? JSON.parse(row.byteaData) : row.byteaData;
      // expect(Buffer.from(parsedBytea.data || parsedBytea).toString()).toBe("hello world");
    });
  });
}
