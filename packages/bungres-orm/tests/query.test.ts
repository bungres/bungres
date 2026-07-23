import { describe, expect, it } from "bun:test";
import {
  and, arrayContained, arrayContains, arrayOverlaps, avg, boolean, containsJson, count, DeleteBuilder,
  eq, gt, gte, hasAnyKeys, hasKey, ilike, inArray, InsertBuilder, integer, isNotNull, isNull, jsonExtractText, like, lt, lte, max, min, ne, not, or, over, pgTable, plainToTsquery, SelectBuilder, sum, text, timestamptz, toTsquery, toTsvector, tsMatch, UpdateBuilder, uuid, varchar, withCte, type QueryExecutor
} from "../src/index.js";

const dummyExecutor: QueryExecutor = {
  execute: async () => [],
  executeSingle: async () => null,
};

// ── Shared test table ───────────────────────────────────────────────────────

const users = pgTable("users", {
  id: uuid("id", { primaryKey: true }),
  email: varchar("email", { length: 255, notNull: true, unique: true }),
  name: text("name"),
  age: integer("age"),
  verified: boolean("verified", { notNull: true, default: false }),
  createdAt: timestamptz("created_at", { notNull: true, defaultRaw: "NOW()" }),
});

// ── SELECT ──────────────────────────────────────────────────────────────────

describe("SelectBuilder", () => {
  it("generates a basic SELECT *", () => {
    const { sql, params } = new SelectBuilder(users, dummyExecutor).toSQL();
    expect(sql).toBe('SELECT "users"."id" AS "id", "users"."email" AS "email", "users"."name" AS "name", "users"."age" AS "age", "users"."verified" AS "verified", "users"."created_at" AS "createdAt" FROM "users"');
    expect(params).toHaveLength(0);
  });

  it("generates SELECT with specific columns", () => {
    const { sql } = new SelectBuilder(users, dummyExecutor).select("id", "email").toSQL();
    expect(sql).toBe('SELECT "users"."id" AS "id", "users"."email" AS "email" FROM "users"');
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
    expect(sql).toContain('ORDER BY "users"."created_at" DESC');
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
    expect(sql).toBe('SELECT "users"."age" AS "userAge" FROM "users"');
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

  it("generates INSERT with ON CONFLICT DO UPDATE", () => {
    const { sql, params } = new InsertBuilder(users, dummyExecutor)
      .values({ email: "dave@example.com", name: "Dave" })
      .onConflictDoUpdate({
        target: "email",
        set: { name: "Dave Updated" },
      })
      .toSQL();
    expect(sql).toContain('ON CONFLICT ("email") DO UPDATE SET "name" = $3');
    expect(params).toEqual(["dave@example.com", "Dave", "Dave Updated"]);
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

  it("inserts array values directly as parameters", () => {
    const testTable = pgTable("test", {
      tags: text("tags").array()
    });
    const { sql, params } = new InsertBuilder(testTable, dummyExecutor)
      .values({ tags: ["a", "b", "c"] })
      .toSQL();
    expect(sql).toBe('INSERT INTO "test" ("tags") VALUES ($1)');
    expect(params).toEqual([["a", "b", "c"]]);
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

  it("updates array values directly as parameters", () => {
    const testTable = pgTable("test", {
      tags: text("tags").array()
    });
    const { sql, params } = new UpdateBuilder(testTable, dummyExecutor)
      .set({ tags: ["updated", "tags"] })
      .toSQL();
    expect(sql).toBe('UPDATE "test" SET "tags" = $1');
    expect(params).toEqual([["updated", "tags"]]);
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

  it("inArray produces IN (...)", () => {
    const { sql, params } = inArray("status", ["active", "pending"]);
    expect(sql).toContain("IN ($1, $2)");
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

// ── JSONB Condition helpers ──────────────────────────────────────────────────

describe("JSONB Condition helpers", () => {
  it("containsJson produces @>", () => {
    const { sql, params } = containsJson("data", { role: "admin" });
    expect(sql).toContain("@>");
    expect(sql).toContain("::jsonb");
    expect(params).toHaveLength(1);
    expect(params[0]).toEqual({ role: "admin" });
  });

  it("hasKey produces ?", () => {
    const { sql, params } = hasKey("data", "role");
    expect(sql).toContain("?");
    expect(params).toContain("role");
  });

  it("hasAnyKeys produces ?|", () => {
    const { sql, params } = hasAnyKeys("data", ["role", "age"]);
    expect(sql).toContain("?|");
    expect(sql).toContain("ARRAY[$1, $2]");
    expect(params).toEqual(["role", "age"]);
  });

  it("jsonExtractText produces ->>", () => {
    const { sql, params } = jsonExtractText("data", "role");
    expect(sql).toContain("->> $1");
    expect(params[0]).toBe("role");
  });
});

// ── CTE and Set Operations ──────────────────────────────────────────────────

describe("CTE and Set Operations", () => {
  it("SelectBuilder > generates query with CTE", () => {
    const activeUsers = withCte("active_users", new SelectBuilder(users, dummyExecutor).where(eq("verified", true)));

    const { sql, params } = new SelectBuilder(users, dummyExecutor)
      .with(activeUsers)
      .select("id")
      .toSQL();

    expect(sql).toContain('WITH "active_users" AS (SELECT "users"."id" AS "id", "users"."email" AS "email", "users"."name" AS "name", "users"."age" AS "age", "users"."verified" AS "verified", "users"."created_at" AS "createdAt" FROM "users" WHERE "verified" = $1)');
    expect(sql).toContain('SELECT "users"."id" AS "id" FROM "users"');
    expect(params).toEqual([true]);
  });

  it("SelectBuilder > generates query with UNION", () => {
    const q1 = new SelectBuilder(users, dummyExecutor).select("id").where(eq("name", "Alice"));
    const q2 = new SelectBuilder(users, dummyExecutor).select("id").where(eq("name", "Bob"));

    const { sql, params } = q1.union(q2).toSQL();
    expect(sql).toContain('UNION SELECT "users"."id" AS "id" FROM "users" WHERE "name" = $2');
    expect(params).toEqual(["Alice", "Bob"]);
  });
});

// ── Window Functions ────────────────────────────────────────────────────────

describe("Window Functions", () => {
  it("over() > generates basic OVER clause", () => {
    const { sql } = over(count());
    expect(sql).toBe("COUNT(*) OVER ()");
  });

  it("over() > generates OVER with PARTITION BY", () => {
    const { sql, params } = over(count(), { partitionBy: users.verified });
    expect(sql).toBe('COUNT(*) OVER (PARTITION BY "users"."verified")');
    expect(params).toHaveLength(0);
  });

  it("over() > generates OVER with ORDER BY", () => {
    const { sql, params } = over(count(), { orderBy: { column: users.createdAt, dir: "desc" } });
    expect(sql).toBe('COUNT(*) OVER (ORDER BY "users"."created_at" DESC)');
    expect(params).toHaveLength(0);
  });

  it("over() > generates OVER with both PARTITION BY and ORDER BY", () => {
    const { sql } = over(count(), {
      partitionBy: users.verified,
      orderBy: [{ column: users.createdAt, dir: "desc" }]
    });
    expect(sql).toBe('COUNT(*) OVER (PARTITION BY "users"."verified" ORDER BY "users"."created_at" DESC)');
  });
});

// ── Aggregations ──────────────────────────────────────────────────────────────

describe("Aggregations", () => {
  it("count() > generates COUNT(*)", () => {
    const { sql } = count();
    expect(sql).toBe("COUNT(*)");
  });

  it("sum() > generates SUM(col)", () => {
    const { sql } = sum(users.age);
    expect(sql).toBe('SUM("users"."age")');
  });

  it("avg() > generates AVG(col)", () => {
    const { sql } = avg(users.age);
    expect(sql).toBe('AVG("users"."age")');
  });

  it("min() > generates MIN(col)", () => {
    const { sql } = min(users.age);
    expect(sql).toBe('MIN("users"."age")');
  });

  it("max() > generates MAX(col)", () => {
    const { sql } = max(users.age);
    expect(sql).toBe('MAX("users"."age")');
  });
});

// ── Array Operators ─────────────────────────────────────────────────────────

describe("Array Operators", () => {
  it("arrayContains() > generates @>", () => {
    const { sql, params } = arrayContains("tags", ["a", "b"]);
    expect(sql).toBe('"tags" @> ARRAY[$1, $2]');
    expect(params).toEqual(["a", "b"]);
  });

  it("arrayContained() > generates <@", () => {
    const { sql, params } = arrayContained("tags", ["a", "b"]);
    expect(sql).toBe('"tags" <@ ARRAY[$1, $2]');
    expect(params).toEqual(["a", "b"]);
  });

  it("arrayOverlaps() > generates &&", () => {
    const { sql, params } = arrayOverlaps("tags", ["a", "b"]);
    expect(sql).toBe('"tags" && ARRAY[$1, $2]');
    expect(params).toEqual(["a", "b"]);
  });
});

// ── Full Text Search ────────────────────────────────────────────────────────

describe("Full Text Search", () => {
  it("toTsquery() > generates to_tsquery", () => {
    const { sql, params } = toTsquery("'cat' & 'dog'");
    expect(sql).toBe("to_tsquery($1)");
    expect(params).toEqual(["'cat' & 'dog'"]);
  });

  it("plainToTsquery() > generates plainto_tsquery", () => {
    const { sql, params } = plainToTsquery("'cat dog'");
    expect(sql).toBe("plainto_tsquery($1)");
    expect(params).toEqual(["'cat dog'"]);
  });

  it("toTsvector() > without config generates to_tsvector(col)", () => {
    const { sql } = toTsvector(users.name);
    expect(sql).toBe('to_tsvector("users"."name")');
  });

  it("toTsvector() > with config generates to_tsvector(config, col)", () => {
    const { sql, params } = toTsvector(users.name, "'english'");
    expect(sql).toBe('to_tsvector($1::regconfig, "users"."name")');
    expect(params).toEqual(["'english'"]);
  });

  it("tsMatch() > with string generates @@ plainto_tsquery", () => {
    const { sql, params } = tsMatch(toTsvector(users.name), "'hello'");
    expect(sql).toBe('to_tsvector("users"."name") @@ plainto_tsquery($1)');
    expect(params).toEqual(["'hello'"]);
  });

  it("tsMatch() > with SQLChunk generates @@", () => {
    const { sql, params } = tsMatch(toTsvector(users.name), toTsquery("'hello'"));
    expect(sql).toBe('to_tsvector("users"."name") @@ to_tsquery($1)');
    expect(params).toEqual(["'hello'"]);
  });
});
