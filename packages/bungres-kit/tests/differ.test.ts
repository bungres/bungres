import { describe, expect, test } from "bun:test";
import { diffSchemas, topoSortConfigs, type SchemaSnapshot } from "../src/differ.js";
import type { TableConfig } from "@bungres/orm";

describe("Schema Differ & TopoSort", () => {
  test("diffSchemas detects new tables and creates enums first", () => {
    const prev: SchemaSnapshot = { tables: {}, enums: {}, views: {} };
    const next: SchemaSnapshot = {
      enums: {
        user_role: { enumName: "user_role", enumValues: ["admin", "user"] }
      },
      tables: {
        users: {
          name: "users",
          columns: {
            id: { name: "id", dataType: "uuid", notNull: true, primaryKey: true },
            role: { name: "role", dataType: "user_role", notNull: true }
          } as any,
          primaryKeys: [],
          indexes: [],
          foreignKeys: [],
          checks: []
        }
      },
      views: {}
    };

    const result = diffSchemas(prev, next);
    expect(result.statements.length).toBeGreaterThan(0);
    expect(result.statements[0]).toContain(`CREATE TYPE "user_role" AS ENUM`);
    expect(result.statements[1]).toContain(`CREATE TABLE IF NOT EXISTS "users"`);
    expect(result.summary).toContain("CREATE TYPE user_role");
    expect(result.summary).toContain("CREATE TABLE users");
  });

  test("diffSchemas handles enum value additions (ALTER TYPE ... ADD VALUE)", () => {
    const prev: SchemaSnapshot = {
      enums: {
        user_role: { enumName: "user_role", enumValues: ["admin", "user"] }
      },
      tables: {},
      views: {}
    };
    const next: SchemaSnapshot = {
      enums: {
        user_role: { enumName: "user_role", enumValues: ["admin", "user", "moderator"] }
      },
      tables: {},
      views: {}
    };

    const result = diffSchemas(prev, next);
    expect(result.statements.length).toBe(1);
    expect(result.statements[0]).toBe(`ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'moderator';`);
    expect(result.summary[0]).toBe(`ALTER TYPE user_role ADD VALUE 'moderator'`);
  });

  test("diffSchemas handles column additions and drops", () => {
    const prev: SchemaSnapshot = {
      enums: {},
      tables: {
        posts: {
          name: "posts",
          columns: {
            id: { name: "id", dataType: "uuid", notNull: true },
            title: { name: "title", dataType: "varchar", notNull: true }
          } as any,
          primaryKeys: [],
          indexes: [],
          foreignKeys: [],
          checks: []
        }
      },
      views: {}
    };

    const next: SchemaSnapshot = {
      enums: {},
      tables: {
        posts: {
          name: "posts",
          columns: {
            id: { name: "id", dataType: "uuid", notNull: true },
            content: { name: "content", dataType: "text", notNull: false }
          } as any,
          primaryKeys: [],
          indexes: [],
          foreignKeys: [],
          checks: []
        }
      },
      views: {}
    };

    const result = diffSchemas(prev, next);
    expect(result.summary).toContain("ALTER TABLE posts ADD COLUMN content");
    expect(result.summary).toContain("ALTER TABLE posts DROP COLUMN title");
    expect(result.warnings.some((w) => w.includes("Column 'title'"))).toBe(true);
  });

  test("topoSortConfigs orders dependent foreign key tables correctly", () => {
    const usersTable: TableConfig = {
      name: "users",
      columns: { id: { name: "id", dataType: "uuid" } } as any,
      primaryKeys: [],
      indexes: [],
      foreignKeys: [],
      checks: []
    };

    const postsTable: TableConfig = {
      name: "posts",
      columns: {
        id: { name: "id", dataType: "uuid" },
        user_id: {
          name: "user_id",
          dataType: "uuid",
          references: { table: "users", column: "id" }
        }
      } as any,
      primaryKeys: [],
      indexes: [],
      foreignKeys: [],
      checks: []
    };

    const sorted = topoSortConfigs([postsTable, usersTable]);
    expect(sorted.map((t) => t.name)).toEqual(["users", "posts"]);
  });
  test("diffSchemas handles index definition changes", () => {
    const prev: SchemaSnapshot = {
      enums: {},
      tables: {
        users: {
          name: "users",
          columns: { id: { name: "id", dataType: "uuid" } } as any,
          indexes: [{ name: "idx_users_id", columns: ["id"], unique: false }],
          primaryKeys: [],
          foreignKeys: [],
          checks: []
        }
      },
      views: {}
    };

    const next: SchemaSnapshot = {
      enums: {},
      tables: {
        users: {
          name: "users",
          columns: { id: { name: "id", dataType: "uuid" } } as any,
          indexes: [{ name: "idx_users_id", columns: ["id"], unique: true }],
          primaryKeys: [],
          foreignKeys: [],
          checks: []
        }
      },
      views: {}
    };

    const result = diffSchemas(prev, next);
    // Should drop the old index and create the new unique index
    expect(result.summary).toContain("DROP INDEX idx_users_id");
    expect(result.summary).toContain("CREATE INDEX idx_users_id ON users");
    expect(result.statements.some(s => s.includes("DROP INDEX"))).toBe(true);
    expect(result.statements.some(s => s.includes("CREATE UNIQUE INDEX"))).toBe(true);
  });
});
