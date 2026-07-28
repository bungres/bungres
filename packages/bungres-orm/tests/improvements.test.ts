import { describe, expect, it } from "bun:test";
import {
    BungresDB,
    BungresError,
    ConnectionError,
    DeleteBuilder,
    QueryError,
    SelectBuilder,
    TransactionError,
    ValidationError,
    betweenDate,
    contains,
    deletedAt,
    denseRank,
    endsWith,
    integer,
    pgTable,
    rank,
    rowNumber,
    startsWith,
    stddev,
    text,
    validateSchema,
    validateTable,
    variance,
} from "../src/index.js";

const users = pgTable("users", {
    id: integer("id", { primaryKey: true }),
    name: text("name", { notNull: true }),
    email: text("email"),
    deletedAt: deletedAt("deleted_at"),
});

const mockExecutor = {
    async execute(builder: any) {
        return [{ id: 1, name: "Alice" }];
    },
    async executeSingle(builder: any) {
        return { id: 1, name: "Alice" };
    },
};

describe("Improvements Roadmap Tests", () => {
    describe("Error Class Hierarchy", () => {
        it("instantiates custom error classes inheriting from BungresError", () => {
            const bErr = new BungresError("base error");
            const qErr = new QueryError("query failed", { sql: "SELECT 1", params: [] });
            const cErr = new ConnectionError("conn failed");
            const vErr = new ValidationError("invalid schema");
            const tErr = new TransactionError("tx failed");

            expect(bErr).toBeInstanceOf(Error);
            expect(bErr).toBeInstanceOf(BungresError);

            expect(qErr).toBeInstanceOf(BungresError);
            expect(qErr.sql).toBe("SELECT 1");

            expect(cErr).toBeInstanceOf(BungresError);
            expect(vErr).toBeInstanceOf(BungresError);
            expect(tErr).toBeInstanceOf(BungresError);
        });

        it("validates postgres connection URLs", () => {
            expect(() => new BungresDB("invalid-url")).toThrow(ConnectionError);
            expect(() => new BungresDB("http://localhost:5432/db")).toThrow(ConnectionError);
        });
    });

    describe("Pagination Helpers", () => {
        it("generates correct LIMIT and OFFSET for paginate()", () => {
            const query = new SelectBuilder(users, mockExecutor as any).paginate(3, 10).toSQL();
            expect(query.sql).toContain("LIMIT $1 OFFSET $2");
            expect(query.params).toEqual([10, 20]);
        });

        it("generates correct WHERE and LIMIT for cursorPaginate()", () => {
            const query = new SelectBuilder(users, mockExecutor as any).cursorPaginate(42, 15, "id").toSQL();
            expect(query.sql).toContain('WHERE "users"."id" > $1');
            expect(query.sql).toContain("LIMIT $2");
            expect(query.params).toEqual([42, 15]);
        });
    });

    describe("Soft Delete & Column Helpers", () => {
        it("creates deletedAt column config", () => {
            expect(users.deletedAt.dataType).toBe("timestamptz");
            expect(users.deletedAt.name).toBe("deleted_at");
        });

        it("generates UPDATE query from softDelete()", () => {
            const updateBuilder = new DeleteBuilder(users, mockExecutor as any).where({ id: 1 }).softDelete("deletedAt");
            const query = updateBuilder.toSQL();
            expect(query.sql).toContain('UPDATE "users" SET "deleted_at" = $1 WHERE "users"."id" = $2');
            expect(query.params[1]).toBe(1);
        });
    });

    describe("New Condition Helpers", () => {
        it("startsWith generates LIKE prefix%", () => {
            const c = startsWith(users.name, "Ali");
            expect(c.sql).toBe('"users"."name" LIKE $1');
            expect(c.params).toEqual(["Ali%"]);
        });

        it("endsWith generates LIKE %suffix", () => {
            const c = endsWith(users.name, "ice");
            expect(c.sql).toBe('"users"."name" LIKE $1');
            expect(c.params).toEqual(["%ice"]);
        });

        it("contains generates LIKE %substring%", () => {
            const c = contains(users.name, "lic");
            expect(c.sql).toBe('"users"."name" LIKE $1');
            expect(c.params).toEqual(["%lic%"]);
        });

        it("betweenDate generates BETWEEN start AND end", () => {
            const start = new Date("2026-01-01");
            const end = new Date("2026-12-31");
            const c = betweenDate(users.deletedAt, start, end);
            expect(c.sql).toBe('"users"."deleted_at" BETWEEN $1 AND $2');
            expect(c.params).toEqual([start, end]);
        });
    });

    describe("New Aggregation & Window Helpers", () => {
        it("generates STDDEV and VARIANCE sql", () => {
            expect(stddev(users.id).sql).toBe('STDDEV("users"."id")');
            expect(variance(users.id).sql).toBe('VARIANCE("users"."id")');
        });

        it("generates ROW_NUMBER(), RANK(), DENSE_RANK() window functions", () => {
            const rNum = rowNumber({ orderBy: { column: users.id, dir: "desc" } });
            expect(rNum.sql).toBe('ROW_NUMBER() OVER (ORDER BY "users"."id" DESC)');

            const rk = rank({ partitionBy: users.name });
            expect(rk.sql).toBe('RANK() OVER (PARTITION BY "users"."name")');

            const dRk = denseRank({ orderBy: { column: users.id, dir: "asc" } });
            expect(dRk.sql).toBe('DENSE_RANK() OVER (ORDER BY "users"."id" ASC)');
        });
    });

    describe("Schema Validation", () => {
        it("validates a healthy table", () => {
            const res = validateTable(users);
            expect(res.valid).toBe(true);
            expect(res.issues.filter((i) => i.type === "error")).toHaveLength(0);
        });

        it("detects table missing primary key as warning", () => {
            const tNoPk = pgTable("no_pk", {
                name: text("name"),
            });
            const res = validateTable(tNoPk);
            expect(res.valid).toBe(true);
            expect(res.issues.some((i) => i.message.includes("no primary key"))).toBe(true);
        });

        it("validates a full schema object", () => {
            const schema = { users };
            const res = validateSchema(schema);
            expect(res.valid).toBe(true);
        });
    });

    describe("Pool Status & Logging", () => {
        it("returns pool status from BungresDB", () => {
            const db = new BungresDB({ url: "postgres://user:pass@localhost:5432/testdb", max: 5 });
            const status = db.getPoolStatus();
            expect(status.total).toBe(5);
            expect(status.active).toBe(0);
            expect(status.idle).toBe(5);
            expect(db.getLastQuery()).toBeNull();
        });
    });
});
