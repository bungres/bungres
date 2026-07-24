import { describe, expect, test } from "bun:test";
import { splitSqlStatements } from "../src/sql-splitter.js";

describe("splitSqlStatements", () => {
  test("splits basic SQL statements by semicolon", () => {
    const sql = "CREATE TABLE users (id UUID); CREATE TABLE posts (id UUID);";
    const stmts = splitSqlStatements(sql);
    expect(stmts).toEqual([
      "CREATE TABLE users (id UUID)",
      "CREATE TABLE posts (id UUID)"
    ]);
  });

  test("does NOT split semicolons inside single-quoted strings or defaults", () => {
    const sql = "CREATE TABLE t (val TEXT DEFAULT 'hello;world'); INSERT INTO t VALUES (';');";
    const stmts = splitSqlStatements(sql);
    expect(stmts).toEqual([
      "CREATE TABLE t (val TEXT DEFAULT 'hello;world')",
      "INSERT INTO t VALUES (';')"
    ]);
  });

  test("does NOT split semicolons inside dollar quotes ($$)", () => {
    const sql = "DO $$ BEGIN SELECT 1; SELECT 2; END $$; CREATE TABLE foo (id INT);";
    const stmts = splitSqlStatements(sql);
    expect(stmts).toEqual([
      "DO $$ BEGIN SELECT 1; SELECT 2; END $$",
      "CREATE TABLE foo (id INT)"
    ]);
  });

  test("does NOT split semicolons inside comments", () => {
    const sql = "-- comment with ; inside\nCREATE TABLE bar (id INT); /* block ; comment */ SELECT 1;";
    const stmts = splitSqlStatements(sql);
    expect(stmts.length).toBe(2);
    expect(stmts[0]).toContain("CREATE TABLE bar");
    expect(stmts[1]).toContain("SELECT 1");
  });
});
