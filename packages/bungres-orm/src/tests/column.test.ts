import { describe, it, expect } from "bun:test";
import {
  text, varchar, integer, uuid, serial, boolean,
  timestamptz, jsonb,
} from "../index.js";

describe("Column Builder Functions", () => {
  it("creates a basic text column", () => {
    const col = text("name");
    expect(col.name).toBe("name");
    expect(col.dataType).toBe("text");
    expect(col.notNull).toBe(false);
    expect(col.primaryKey).toBe(false);
  });

  it("options.notNull sets notNull flag", () => {
    const col = text("email", { notNull: true });
    expect(col.notNull).toBe(true);
  });

  it("options.primaryKey sets primaryKey and notNull", () => {
    const col = uuid("id", { primaryKey: true });
    expect(col.primaryKey).toBe(true);
    expect(col.notNull).toBe(true);
  });

  it("options.unique sets unique flag", () => {
    const col = varchar("slug", { length: 255, unique: true });
    expect(col.unique).toBe(true);
  });

  it("options.default stores a literal default", () => {
    const col = boolean("active", { default: true });
    expect(col.defaultValue).toBe(true);
  });

  it("options.defaultRaw stores a SQL expression", () => {
    const col = timestamptz("created_at", { defaultRaw: "NOW()" });
    expect(col.defaultFn).toBe("NOW()");
  });

  it("options.references stores FK config", () => {
    const col = uuid("user_id", { references: { table: "users", column: "id", onDelete: "cascade" } });
    expect(col.references).toEqual({
      table: "users",
      column: "id",
      onDelete: "cascade",
    });
  });

  it("serial column is notNull by default", () => {
    const col = serial("id");
    expect(col.notNull).toBe(true);
    expect(col.dataType).toBe("serial");
  });

  it("uuid() does not set a default without primaryKey", () => {
    const col = uuid("id");
    expect(col.defaultFn).toBeUndefined();
  });

  it("uuid() with primaryKey has defaultRaw gen_random_uuid()", () => {
    const col = uuid("id", { primaryKey: true });
    expect(col.defaultFn).toBe("gen_random_uuid()");
  });

  it("varchar stores length in config", () => {
    const col = varchar("title", { length: 500 });
    expect((col as any).length).toBe(500);
  });

  it("jsonb column type is jsonb", () => {
    const col = jsonb("meta");
    expect(col.dataType).toBe("jsonb");
  });

  it("supports the .array() modifier", () => {
    const col = text("tags").array();
    expect(col.dataType).toBe("text[]");
  });

  it("supports .generatedAlwaysAs()", () => {
    const col = text("full_name").generatedAlwaysAs("first_name || ' ' || last_name");
    expect(col.generatedAs).toBe("first_name || ' ' || last_name");
  });

  it("supports customType()", () => {
    // Need to import customType, but we can just use it if we import it or we can require it
    const { customType } = require("../index.js");
    const citext = customType("citext");
    const col = citext("email_citext");
    expect(col.dataType).toBe("citext");
  });
});
