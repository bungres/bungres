import { describe, expect, test } from "bun:test";
import { sql, shiftParams } from "../src/core/sql.js";
import { parseWhereObject, inArray, or } from "../src/core/conditions.js";
import { pgTable } from "../src/schema/table.js";
import { text, integer } from "../src/schema/columns.js";
import { SelectBuilder } from "../src/builders/select.js";
import { InsertBuilder } from "../src/builders/insert.js";
import { RelationalQueryBuilder } from "../src/builders/relational.js";
import type { QueryExecutor } from "../src/core/query.js";

const mockExecutor: QueryExecutor = {
  async execute() { return []; },
  async executeSingle() { return null; },
  async raw() { return []; },
};

const users = pgTable("users", {
  id: integer("id", { primaryKey: true }),
  name: text("name"),
});

describe("ORM Scanning Bug Reproduction Tests", () => {
  test("1. parseWhereObject should handle SQLChunk values without dropping them", () => {
    const rawVal = sql`NOW()`;
    const res = parseWhereObject((users as any)[Symbol.for("BungresTableConfig")], {
      name: rawVal as any,
    });
    // Currently, rawVal as object is ignored and returns TRUE or empty condition
    expect(res.sql).not.toBe("TRUE");
    expect(res.sql).toContain('"name" = NOW()');
  });

  test("2. shiftParams should handle single quotes inside escaped string", () => {
    // String containing escaped quote 'O''Reilly''s'
    const sqlWithEscapedQuote = "SELECT * FROM users WHERE name = 'O''Reilly''s' AND id = $1";
    const shifted = shiftParams(sqlWithEscapedQuote, 1, 5);
    // id = $1 should be shifted to id = $6
    expect(shifted).toBe("SELECT * FROM users WHERE name = 'O''Reilly''s' AND id = $6");
  });

  test("3. Naive regex replace in SelectBuilder should not shift $N inside string literals", () => {
    const subquery = sql`SELECT 'Price is $100' AS text_val, id FROM users WHERE id = ${42}`;
    const builder = new SelectBuilder(users, mockExecutor, {
      val: sql`func(${123})` as any,
    });
    builder.where(subquery);
    const result = builder.toSQL();
    // 'Price is $100' should NOT become 'Price is $200'!
    expect(result.sql).toContain("'Price is $100'");
  });

  test("4. inArray should handle SQLChunk directly as values", () => {
    const subQueryChunk = sql`SELECT id FROM other_table WHERE active = ${true}`;
    const res = inArray(users.id, subQueryChunk as any);
    expect(res.sql).toBe('"users"."id" IN (SELECT id FROM other_table WHERE active = $1)');
    expect(res.params).toEqual([true]);
  });

  test("5. or() with 0 arguments should return FALSE instead of ()", () => {
    const res = or();
    expect(res.sql).not.toBe("()");
    expect(res.sql).toBe("FALSE");
  });

  test("6. Relational Query Builder should support multiple FKs to same target table", () => {
    const posts = pgTable("posts", {
      id: integer("id", { primaryKey: true }),
      authorId: integer("author_id", { references: { table: "users", column: "id" } }),
      editorId: integer("editor_id", { references: { table: "users", column: "id" } }),
    });
    const schema = { users, posts };
    const qb = new RelationalQueryBuilder(mockExecutor, schema as any, "posts");
    const relations = (qb as any)._getRuntimeRelations("posts");
    expect(Object.keys(relations.ones).length).toBe(2);
  });
});
