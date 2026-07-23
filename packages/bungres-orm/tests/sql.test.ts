import { describe, expect, it } from "bun:test";
import { rawSql, sql, sqlJoin } from "../src/index.js";

describe("sql tagged template", () => {
  it("builds a simple parameterized query", () => {
    const chunk = sql`SELECT * FROM "users" WHERE id = ${42}`;
    expect(chunk.sql).toBe('SELECT * FROM "users" WHERE id = $1');
    expect(chunk.params).toEqual([42]);
  });

  it("handles multiple params with correct numbering", () => {
    const chunk = sql`SELECT * FROM "users" WHERE email = ${"alice@example.com"} AND verified = ${true}`;
    expect(chunk.sql).toBe('SELECT * FROM "users" WHERE email = $1 AND verified = $2');
    expect(chunk.params).toEqual(["alice@example.com", true]);
  });

  it("composes nested sql chunks and re-numbers params", () => {
    const inner = sql`id = ${1}`;
    const outer = sql`SELECT * FROM "users" WHERE ${inner} AND name = ${"alice"}`;
    expect(chunk(outer).sql).toBe('SELECT * FROM "users" WHERE id = $1 AND name = $2');
    expect(outer.params).toEqual([1, "alice"]);
  });

  it("rawSql passes through with no params", () => {
    const chunk = rawSql(`SELECT NOW()`);
    expect(chunk.sql).toBe("SELECT NOW()");
    expect(chunk.params).toHaveLength(0);
  });

  it("sqlJoin combines chunks with separator", () => {
    const a = sql`"name" = ${"alice"}`;
    const b = sql`"age" > ${18}`;
    const joined = sqlJoin([a, b], " AND ");
    expect(joined.sql).toBe('"name" = $1 AND "age" > $2');
    expect(joined.params).toEqual(["alice", 18]);
  });

  it("sqlJoin re-numbers params correctly across chunks", () => {
    const a = sql`a = ${1} AND b = ${2}`;
    const b = sql`c = ${3}`;
    const joined = sqlJoin([a, b], " AND ");
    expect(joined.sql).toBe("a = $1 AND b = $2 AND c = $3");
    expect(joined.params).toEqual([1, 2, 3]);
  });

  it("ignores $N inside single or double quotes when merging chunks", () => {
    const inner = sql`val = ${100}`;
    const chunk = sql`SELECT * FROM users WHERE col1 = '$1' AND col2 = "$2" AND ${inner}`;
    expect(chunk.sql).toBe(`SELECT * FROM users WHERE col1 = '$1' AND col2 = "$2" AND val = $1`);
    expect(chunk.params).toEqual([100]);
  });
});

// small helper to unwrap for readability
function chunk(c: { sql: string; params: unknown[] }) {
  return c;
}
