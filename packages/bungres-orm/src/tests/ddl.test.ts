import { describe, it, expect } from "bun:test";
import { generateCreateTable, generateDropTable, generateAddColumn, generateDropColumn, generateCreateEnum, generateDropEnum, generateCreateView, generateDropView } from "../ddl.js";
import { pgEnum, pgView, pgMaterializedView, SelectBuilder, table, text, boolean, getTableConfig, customType, varchar } from "../index.js";
import type { TableConfig, QueryExecutor } from "../index.js";

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
    const config = getTableConfig(
      table("users", { id: text("id") })
    ) as TableConfig;
    const sql = generateCreateTable(config, false);
    expect(sql).toContain("CREATE TABLE \"users\" (");
  });

  it("generates GENERATED ALWAYS AS (...) STORED", () => {
    const config = getTableConfig(
      table("users", { 
        firstName: text("first_name"),
        lastName: text("last_name"),
        fullName: text("full_name").generatedAlwaysAs("first_name || ' ' || last_name")
      })
    ) as TableConfig;
    const sql = generateCreateTable(config);
    expect(sql).toContain("\"full_name\" TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED");
  });

  it("handles dynamic array types and custom types", () => {
    const citext = customType("citext");
    const config = getTableConfig(
      table("users", { 
        emails: citext("emails").array(),
        titles: varchar("titles", { length: 50 }).array()
      })
    ) as TableConfig;
    const sql = generateCreateTable(config);
    expect(sql).toContain("\"emails\" CITEXT[]");
    expect(sql).toContain("\"titles\" VARCHAR(50)[]");
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

describe("Enum DDL", () => {
  it("generateCreateEnum > creates an enum type", () => {
    const sql = generateCreateEnum("status", ["active", "archived", "deleted"]);
    expect(sql).toBe(`CREATE TYPE "status" AS ENUM ('active', 'archived', 'deleted');`);
  });

  it("generateCreateEnum > escapes single quotes in values", () => {
    const sql = generateCreateEnum("user_role", ["admin", "super'admin"]);
    expect(sql).toBe(`CREATE TYPE "user_role" AS ENUM ('admin', 'super''admin');`);
  });

  it("generateDropEnum > drops an enum type", () => {
    const sql = generateDropEnum("status");
    expect(sql).toBe(`DROP TYPE IF EXISTS "status";`);
  });

  it("generateCreateTable > uses the enum name for the column type", () => {
    const statusEnum = pgEnum("status", ["active", "archived"]);
    
    const config = {
      name: "users",
      columns: {
        id: { name: "id", dataType: "uuid", notNull: true, primaryKey: true, unique: false },
        status: statusEnum("status", { default: "active" }),
      }
    } as any;

    const sql = generateCreateTable(config);
    expect(sql).toContain(`"status" "status" DEFAULT 'active'`);
  });
});

// ── Views DDL ───────────────────────────────────────────────────────────────

const dummyExecutor: QueryExecutor = {
  execute: async () => [],
  executeSingle: async () => null,
};

const usersTable = table("users", {
  id: text("id"),
  verified: boolean("verified")
});

describe("Views DDL", () => {
  it("generateCreateView > generates CREATE VIEW with inlined params", () => {
    const qb = new SelectBuilder(usersTable, dummyExecutor).select("id").where({ verified: true });
    const view = pgView("active_users", qb);
    
    const sql = generateCreateView(view);
    expect(sql).toBe('CREATE VIEW "active_users" AS SELECT "users"."id" AS "id" FROM "users" WHERE "users"."verified" = TRUE;');
  });

  it("generateCreateView > generates CREATE MATERIALIZED VIEW", () => {
    const qb = new SelectBuilder(usersTable, dummyExecutor).select("id").where({ verified: false });
    const view = pgMaterializedView("inactive_users", qb);
    
    const sql = generateCreateView(view);
    expect(sql).toBe('CREATE MATERIALIZED VIEW "inactive_users" AS SELECT "users"."id" AS "id" FROM "users" WHERE "users"."verified" = FALSE;');
  });

  it("generateDropView > generates DROP VIEW IF EXISTS", () => {
    const view = pgView("active_users", new SelectBuilder(usersTable, dummyExecutor));
    const sql = generateDropView(view);
    expect(sql).toBe('DROP VIEW IF EXISTS "active_users";');
  });

  it("generateDropView > generates DROP MATERIALIZED VIEW", () => {
    const view = pgMaterializedView("inactive_users", new SelectBuilder(usersTable, dummyExecutor));
    const sql = generateDropView(view, false);
    expect(sql).toBe('DROP MATERIALIZED VIEW "inactive_users";');
  });
});
