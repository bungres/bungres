import { describe, it, expect } from "bun:test";
import { table, getTableConfig } from "../table.js";
import { uuid, text, varchar, boolean, timestamptz } from "../column.js";

const users = table("users", {
  id:        uuid("id", { primaryKey: true }),
  email:     varchar("email", { length: 255, notNull: true, unique: true }),
  username:  text("username", { notNull: true }),
  verified:  boolean("verified", { notNull: true, default: false }),
  createdAt: timestamptz("created_at", { notNull: true, defaultRaw: "NOW()" }),
});

describe("table", () => {
  it("stores the table name", () => {
    expect(getTableConfig(users).name).toBe("users");
  });

  it("qualified name without schema is just the table name", () => {
    expect(getTableConfig(users).qualifiedName).toBe('"users"');
  });

  it("qualified name with schema includes schema prefix", () => {
    const t = table("orders", { id: uuid("id", { primaryKey: true }) }, { schema: "billing" });
    expect(getTableConfig(t).qualifiedName).toBe('"billing"."orders"');
  });

  it("exposes column configs", () => {
    expect(getTableConfig(users).columns.id.dataType).toBe("uuid");
    expect(getTableConfig(users).columns.email.notNull).toBe(true);
    expect(getTableConfig(users).columns.email.unique).toBe(true);
    expect(getTableConfig(users).columns.verified.defaultValue).toBe(false);
    expect(getTableConfig(users).columns.createdAt.defaultFn).toBe("NOW()");
  });

  it("tableConfig mirrors the table definition", () => {
    expect(getTableConfig(users).name).toBe("users");
    expect(Object.keys(getTableConfig(users).columns)).toContain("email");
  });

  it("stores indexes from options", () => {
    const posts = table(
      "posts",
      { id: uuid("id", { primaryKey: true }), slug: text("slug", { notNull: true }) },
      { indexes: [{ columns: ["slug"], unique: true }] }
    );
    expect(getTableConfig(posts).indexes).toHaveLength(1);
    expect(getTableConfig(posts).indexes[0]?.unique).toBe(true);
  });
});

import { snakeCase, camelCase } from "../table.js";

describe("snakeCase.table", () => {
  it("automatically converts camelCase JS keys to snake_case DB columns", () => {
    const users = snakeCase.table("users", {
      id: uuid(),
      userEmailAddress: varchar({ length: 255 }),
      createdAt: timestamptz(),
    });

    const config = getTableConfig(users);
    expect(config.columns.id.name).toBe("id");
    expect(config.columns.userEmailAddress.name).toBe("user_email_address");
    expect(config.columns.createdAt.name).toBe("created_at");
  });
});

describe("column aliases", () => {
  it("allows setting an alias with .as()", () => {
    const id = uuid("id").as("userId");
    expect((id as any).alias).toBe("userId");
    expect(id.name).toBe("id");
  });
});
