import { describe, it, expect } from "bun:test";
import { table, getTableConfig } from "../index.js";
import { uuid, text, varchar, boolean, timestamptz } from "../index.js";

// `table` now defaults to snake_case — camelCase keys map to snake_case columns automatically
const users = table("users", {
  id:        uuid({ primaryKey: true }),
  email:     varchar({ length: 255, notNull: true, unique: true }),
  username:  text({ notNull: true }),
  verified:  boolean({ notNull: true, default: false }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
});

describe("table", () => {
  it("stores the table name", () => {
    expect(getTableConfig(users).name).toBe("users");
  });

  it("qualified name without schema is just the table name", () => {
    expect(getTableConfig(users).qualifiedName).toBe('"users"');
  });

  it("qualified name with schema includes schema prefix", () => {
    const t = table("orders", { id: uuid({ primaryKey: true }) }, { schema: "billing" });
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
      { id: uuid({ primaryKey: true }), slug: text({ notNull: true }) },
      { indexes: [{ columns: ["slug"], unique: true }] }
    );
    expect(getTableConfig(posts).indexes).toHaveLength(1);
    expect(getTableConfig(posts).indexes[0]?.unique).toBe(true);
  });

  it("automatically converts camelCase JS keys to snake_case DB columns", () => {
    const orders = table("orders", {
      id: uuid(),
      userEmailAddress: varchar({ length: 255 }),
      createdAt: timestamptz(),
    });

    const config = getTableConfig(orders);
    expect(config.columns.id.name).toBe("id");
    expect(config.columns.userEmailAddress.name).toBe("user_email_address");
    expect(config.columns.createdAt.name).toBe("created_at");
  });
});

import { camelCase } from "../index.js";

describe("camelCase.table", () => {
  it("keeps camelCase JS keys as-is for DB columns", () => {
    const items = camelCase.table("items", {
      id: uuid(),
      itemName: varchar({ length: 255 }),
    });

    const config = getTableConfig(items);
    expect(config.columns.id.name).toBe("id");
    expect(config.columns.itemName.name).toBe("itemName");
  });
});

describe("column aliases", () => {
  it("allows setting an alias with .as()", () => {
    const id = uuid("id").as("userId");
    expect((id as any).alias).toBe("userId");
    expect(id.name).toBe("id");
  });
});
