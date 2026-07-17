import { describe, it, expect } from "bun:test";
import { generateCreateTable, generateDropTable, generateAddColumn, generateDropColumn } from "../ddl.js";
import type { TableConfig } from "../index.js";

const usersConfig: TableConfig = {
  name: "users",
  columns: {
    id:        { name: "id", dataType: "uuid", notNull: true, primaryKey: true, unique: false, defaultFn: "gen_random_uuid()" },
    email:     { name: "email", dataType: "varchar", notNull: true, primaryKey: false, unique: true },
    verified:  { name: "verified", dataType: "boolean", notNull: true, primaryKey: false, unique: false, defaultValue: false },
    createdAt: { name: "created_at", dataType: "timestamptz", notNull: true, primaryKey: false, unique: false, defaultFn: "NOW()" },
  },
};

const postsConfig: TableConfig = {
  name: "posts",
  schema: "blog",
  columns: {
    id:       { name: "id", dataType: "serial", notNull: true, primaryKey: true, unique: false },
    authorId: { name: "author_id", dataType: "uuid", notNull: true, primaryKey: false, unique: false,
                references: { table: "users", column: "id", onDelete: "cascade" } },
    title:    { name: "title", dataType: "varchar", notNull: true, primaryKey: false, unique: false },
  },
  indexes: [
    { name: "idx_posts_author", columns: ["author_id"], using: "btree" },
  ],
};

describe("generateCreateTable", () => {
  it("creates a basic CREATE TABLE statement", () => {
    const ddl = generateCreateTable(usersConfig);
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS");
    expect(ddl).toContain('"users"');
  });

  it("includes PRIMARY KEY constraint", () => {
    const ddl = generateCreateTable(usersConfig);
    expect(ddl).toContain("PRIMARY KEY");
  });

  it("includes NOT NULL for notNull columns", () => {
    const ddl = generateCreateTable(usersConfig);
    expect(ddl).toContain("NOT NULL");
  });

  it("includes UNIQUE constraint", () => {
    const ddl = generateCreateTable(usersConfig);
    expect(ddl).toContain("UNIQUE");
  });

  it("includes DEFAULT for defaultFn", () => {
    const ddl = generateCreateTable(usersConfig);
    expect(ddl).toContain("DEFAULT gen_random_uuid()");
    expect(ddl).toContain("DEFAULT NOW()");
  });

  it("includes DEFAULT for literal defaultValue", () => {
    const ddl = generateCreateTable(usersConfig);
    expect(ddl).toContain("DEFAULT FALSE");
  });

  it("uses schema-qualified name when schema is set", () => {
    const ddl = generateCreateTable(postsConfig);
    expect(ddl).toContain('"blog"."posts"');
  });

  it("includes REFERENCES for FK columns", () => {
    const ddl = generateCreateTable(postsConfig);
    expect(ddl).toContain('REFERENCES "users"("id")');
    expect(ddl).toContain("ON DELETE CASCADE");
  });

  it("appends CREATE INDEX statements", () => {
    const ddl = generateCreateTable(postsConfig);
    expect(ddl).toContain("CREATE INDEX IF NOT EXISTS");
    expect(ddl).toContain("idx_posts_author");
    expect(ddl).toContain("USING BTREE");
  });

  it("respects ifNotExists=false", () => {
    const ddl = generateCreateTable(usersConfig, false);
    expect(ddl).not.toContain("IF NOT EXISTS");
  });
});

describe("generateDropTable", () => {
  it("generates DROP TABLE IF EXISTS", () => {
    const ddl = generateDropTable(usersConfig);
    expect(ddl).toBe('DROP TABLE IF EXISTS "users";');
  });

  it("generates DROP TABLE without IF EXISTS", () => {
    const ddl = generateDropTable(usersConfig, false);
    expect(ddl).toBe('DROP TABLE "users";');
  });

  it("uses schema prefix", () => {
    const ddl = generateDropTable(postsConfig);
    expect(ddl).toContain('"blog"."posts"');
  });
});

describe("generateAddColumn", () => {
  it("generates ALTER TABLE ADD COLUMN", () => {
    const ddl = generateAddColumn("users", undefined, "bio", {
      name: "bio", dataType: "text", notNull: false, primaryKey: false, unique: false,
    });
    expect(ddl).toContain("ALTER TABLE");
    expect(ddl).toContain("ADD COLUMN IF NOT EXISTS");
    expect(ddl).toContain('"bio"');
  });
});

describe("generateDropColumn", () => {
  it("generates ALTER TABLE DROP COLUMN", () => {
    const ddl = generateDropColumn("users", undefined, "bio");
    expect(ddl).toContain("ALTER TABLE");
    expect(ddl).toContain("DROP COLUMN IF EXISTS");
    expect(ddl).toContain('"bio"');
  });
});
