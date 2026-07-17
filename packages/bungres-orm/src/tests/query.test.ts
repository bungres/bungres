import { describe, it, expect } from "bun:test";
import { table } from "../index.js";
import { uuid, text, varchar, boolean, integer, timestamptz } from "../index.js";
import {
  SelectBuilder, InsertBuilder, UpdateBuilder, DeleteBuilder,
  eq, ne, gt, gte, lt, lte, like, ilike,
  isNull, isNotNull, inArray, and, or, not,
  type QueryExecutor
} from "../index.js";

const dummyExecutor: QueryExecutor = {
  execute: async () => [],
  executeSingle: async () => null,
};

// ── Shared test table ───────────────────────────────────────────────────────

const users = table("users", {
  id:       uuid("id", { primaryKey: true }),
  email:    varchar("email", { length: 255, notNull: true, unique: true }),
  name:     text("name"),
  age:      integer("age"),
  verified: boolean("verified", { notNull: true, default: false }),
  createdAt: timestamptz("created_at", { notNull: true, defaultRaw: "NOW()" }),
});

// ── SELECT ──────────────────────────────────────────────────────────────────

describe("SelectBuilder", () => {
  it("generates a basic SELECT *", () => {
    const { sql, params } = new SelectBuilder(users, dummyExecutor).toSQL();
    expect(sql).toBe('SELECT "id" AS "id", "email" AS "email", "name" AS "name", "age" AS "age", "verified" AS "verified", "created_at" AS "createdAt" FROM "users"');
    expect(params).toHaveLength(0);
  });

  it("generates SELECT with specific columns", () => {
    const { sql } = new SelectBuilder(users, dummyExecutor).select("id", "email").toSQL();
    expect(sql).toBe('SELECT "id" AS "id", "email" AS "email" FROM "users"');
  });

  it("generates WHERE clause", () => {
    const { sql, params } = new SelectBuilder(users, dummyExecutor)
      .where(eq("id", "abc-123"))
      .toSQL();
    expect(sql).toContain("WHERE");
    expect(params).toContain("abc-123");
  });

  it("generates ORDER BY", () => {
    const { sql } = new SelectBuilder(users, dummyExecutor).orderBy("created_at", "desc").toSQL();
    expect(sql).toContain('ORDER BY "created_at" DESC');
  });

  it("generates LIMIT and OFFSET", () => {
    const { sql, params } = new SelectBuilder(users, dummyExecutor).limit(10).offset(20).toSQL();
    expect(sql).toContain("LIMIT");
    expect(sql).toContain("OFFSET");
    expect(params).toContain(10);
    expect(params).toContain(20);
  });

  it("chains multiple WHERE conditions with AND", () => {
    const { sql, params } = new SelectBuilder(users, dummyExecutor)
      .where(eq("verified", true))
      .where(gt("age", 18))
      .toSQL();
    expect(sql).toContain("AND");
    expect(params).toContain(true);
    expect(params).toContain(18);
  });

  it("supports column aliases via .as()", () => {
    const { sql } = new SelectBuilder(users, dummyExecutor)
      .select(users.age.as("userAge"))
      .toSQL();
    expect(sql).toBe('SELECT "age" AS "userAge" FROM "users"');
  });

  it("supports SQL commenter .comment()", () => {
    const { sql } = new SelectBuilder(users, dummyExecutor)
      .comment("test_query_tag")
      .toSQL();
    expect(sql).toContain("/* test_query_tag */");
  });
});

// ── INSERT ──────────────────────────────────────────────────────────────────

describe("InsertBuilder", () => {
  it("generates a basic INSERT", () => {
    const { sql, params } = new InsertBuilder(users, dummyExecutor)
      .values({ email: "alice@example.com", verified: false })
      .toSQL();
    expect(sql).toMatch(/^INSERT INTO "users"/);
    expect(params).toContain("alice@example.com");
  });

  it("generates INSERT with RETURNING", () => {
    const { sql } = new InsertBuilder(users, dummyExecutor)
      .values({ email: "bob@example.com" })
      .returning()
      .toSQL();
    expect(sql).toContain('RETURNING "id" AS "id", "email" AS "email", "name" AS "name", "age" AS "age", "verified" AS "verified", "created_at" AS "createdAt"');
  });

  it("generates INSERT with ON CONFLICT DO NOTHING", () => {
    const { sql } = new InsertBuilder(users, dummyExecutor)
      .values({ email: "carol@example.com" })
      .onConflictDoNothing()
      .toSQL();
    expect(sql).toContain("ON CONFLICT DO NOTHING");
  });

  it("inserts multiple rows", () => {
    const { sql, params } = new InsertBuilder(users, dummyExecutor)
      .values([
        { email: "a@example.com" },
        { email: "b@example.com" },
      ])
      .toSQL();
    expect(sql).toContain("VALUES");
    expect(params).toContain("a@example.com");
    expect(params).toContain("b@example.com");
  });

  it("throws when no values provided", () => {
    expect(() => new InsertBuilder(users, dummyExecutor).toSQL()).toThrow("no values provided");
  });
});

// ── UPDATE ──────────────────────────────────────────────────────────────────

describe("UpdateBuilder", () => {
  it("generates a basic UPDATE", () => {
    const { sql, params } = new UpdateBuilder(users, dummyExecutor)
      .set({ verified: true } as any)
      .where(eq("id", "abc"))
      .toSQL();
    expect(sql).toMatch(/^UPDATE "users" SET/);
    expect(params).toContain(true);
    expect(params).toContain("abc");
  });

  it("generates UPDATE with RETURNING", () => {
    const { sql } = new UpdateBuilder(users, dummyExecutor)
      .set({ verified: true } as any)
      .where(eq("id", "abc"))
      .returning("id", "email")
      .toSQL();
    expect(sql).toContain('RETURNING "id" AS "id", "email" AS "email"');
  });

  it("throws when set() is empty", () => {
    expect(() =>
      new UpdateBuilder(users, dummyExecutor).set({} as any).toSQL()
    ).toThrow("no fields to set");
  });
});

// ── DELETE ──────────────────────────────────────────────────────────────────

describe("DeleteBuilder", () => {
  it("generates a basic DELETE", () => {
    const { sql, params } = new DeleteBuilder(users, dummyExecutor)
      .where(eq("id", "abc"))
      .toSQL();
    expect(sql).toMatch(/^DELETE FROM "users"/);
    expect(params).toContain("abc");
  });

  it("generates DELETE with RETURNING *", () => {
    const { sql } = new DeleteBuilder(users, dummyExecutor)
      .where(eq("id", "abc"))
      .returning()
      .toSQL();
    expect(sql).toContain('RETURNING "id" AS "id", "email" AS "email", "name" AS "name", "age" AS "age", "verified" AS "verified", "created_at" AS "createdAt"');
  });
});

// ── Condition helpers ───────────────────────────────────────────────────────

describe("Condition helpers", () => {
  it("eq produces = $1", () => {
    const { sql, params } = eq("id", "x");
    expect(sql).toContain("=");
    expect(params).toContain("x");
  });

  it("ne produces != $1", () => {
    const { sql } = ne("status", "deleted");
    expect(sql).toContain("!=");
  });

  it("gt / gte / lt / lte produce correct operators", () => {
    expect(gt("age", 18).sql).toContain(">");
    expect(gte("age", 18).sql).toContain(">=");
    expect(lt("age", 65).sql).toContain("<");
    expect(lte("age", 65).sql).toContain("<=");
  });

  it("like / ilike produce correct operators", () => {
    expect(like("name", "%alice%").sql).toContain("LIKE");
    expect(ilike("name", "%alice%").sql).toContain("ILIKE");
  });

  it("isNull / isNotNull produce correct SQL", () => {
    expect(isNull("deleted_at").sql).toContain("IS NULL");
    expect(isNotNull("deleted_at").sql).toContain("IS NOT NULL");
  });

  it("inArray produces ANY(ARRAY[...])", () => {
    const { sql, params } = inArray("status", ["active", "pending"]);
    expect(sql).toContain("ANY(ARRAY[");
    expect(params).toEqual(["active", "pending"]);
  });

  it("inArray with empty array produces FALSE", () => {
    expect(inArray("id", []).sql).toBe("FALSE");
  });

  it("and combines with AND", () => {
    const { sql } = and(eq("a", 1), eq("b", 2));
    expect(sql).toContain("AND");
  });

  it("or wraps in parens with OR", () => {
    const { sql } = or(eq("a", 1), eq("b", 2));
    expect(sql).toContain("OR");
    expect(sql.startsWith("(")).toBe(true);
  });

  it("not wraps in NOT (...)", () => {
    const { sql } = not(eq("verified", false));
    expect(sql.startsWith("NOT (")).toBe(true);
  });
});
