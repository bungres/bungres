import { describe, it, expect } from "bun:test";
import { BungresTransaction } from "../core/db.js";

describe("BungresTransaction > nested transactions", () => {
  it("uses SAVEPOINT and RELEASE SAVEPOINT on success", async () => {
    const executed: string[] = [];
    const mockSql = {
      unsafe: async (sql: string) => {
        executed.push(sql);
        return [];
      }
    };

    const tx = new BungresTransaction(mockSql as any);

    await tx.transaction(async (inner) => {
      await inner.raw("SELECT 1");
    });

    expect(executed).toEqual([
      "SAVEPOINT sp_1",
      "SELECT 1",
      "RELEASE SAVEPOINT sp_1"
    ]);
  });

  it("uses SAVEPOINT and ROLLBACK TO SAVEPOINT on failure", async () => {
    const executed: string[] = [];
    const mockSql = {
      unsafe: async (sql: string) => {
        executed.push(sql);
        return [];
      }
    };

    const tx = new BungresTransaction(mockSql as any);

    try {
      await tx.transaction(async (inner) => {
        await inner.raw("SELECT 2");
        throw new Error("fail");
      });
    } catch (e) {}

    expect(executed).toEqual([
      "SAVEPOINT sp_1",
      "SELECT 2",
      "ROLLBACK TO SAVEPOINT sp_1"
    ]);
  });
});
