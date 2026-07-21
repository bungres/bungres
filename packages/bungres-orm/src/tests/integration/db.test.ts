import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { and, boolean, bungres, eq, gt, ilike, inArray, integer, isNotNull, isNull, sql, pgTable, text, timestamptz, uuid, varchar } from "../../index.js";

const DB_URL = Bun.env.DATABASE_URL;

if (!DB_URL) {
  console.log("  ⚠  Skipping integration tests — no DATABASE_URL set.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Test schema — isolated tables prefixed with _bungres_test_ so they don't
// clash with any real tables in the bunvel database
// ---------------------------------------------------------------------------

const users = pgTable("_bungres_test_users", {
  id: uuid("id", { primaryKey: true }),
  email: varchar("email", { length: 255, notNull: true, unique: true }),
  name: text("name"),
  age: integer("age"),
  verified: boolean("verified", { notNull: true, default: false }),
  createdAt: timestamptz("created_at", { notNull: true, defaultRaw: "NOW()" }),
});

const posts = pgTable("_bungres_test_posts", {
  id: uuid("id", { primaryKey: true }),
  authorId: uuid("author_id", { notNull: true, references: { table: "_bungres_test_users", column: "id", onDelete: "cascade" } }),
  title: varchar("title", { length: 500, notNull: true }),
  views: integer("views", { notNull: true, default: 0 }),
});

type User = { id: string; email: string; name: string | null; age: number | null; verified: boolean; createdAt: Date };
type Post = { id: string; authorId: string; title: string; views: number };

const db = bungres(DB_URL);

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await db.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await db.raw(`
    CREATE TABLE IF NOT EXISTS "_bungres_test_users" (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       VARCHAR(255) NOT NULL UNIQUE,
      name        TEXT,
      age         INTEGER,
      verified    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.raw(`
    CREATE TABLE IF NOT EXISTS "_bungres_test_posts" (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id   UUID NOT NULL REFERENCES "_bungres_test_users"(id) ON DELETE CASCADE,
      title       VARCHAR(500) NOT NULL,
      views       INTEGER NOT NULL DEFAULT 0
    )
  `);
});

afterAll(async () => {
  await db.raw(`DROP TABLE IF EXISTS "_bungres_test_posts"`);
  await db.raw(`DROP TABLE IF EXISTS "_bungres_test_users"`);
  await db.close();
});

// ---------------------------------------------------------------------------
// INSERT
// ---------------------------------------------------------------------------

describe("INSERT", () => {
  it("inserts a single row and returns it", async () => {
    const rows = await db.execute<User>(
      db.insert(users)
        .values({ email: "alice@test.com", name: "Alice", age: 30 })
        .returning()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe("alice@test.com");
    expect(rows[0]!.name).toBe("Alice");
    expect(rows[0]!.verified).toBe(false);
    expect(rows[0]!.id).toBeString();
  });

  it("inserts multiple rows", async () => {
    const rows = await db.execute<User>(
      db.insert(users)
        .values([
          { email: "bob@test.com", name: "Bob", age: 25 },
          { email: "carol@test.com", name: "Carol", age: 40 },
        ])
        .returning()
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.email)).toContain("bob@test.com");
    expect(rows.map((r) => r.email)).toContain("carol@test.com");
  });

  it("respects ON CONFLICT DO NOTHING", async () => {
    const rows = await db.execute<User>(
      db.insert(users)
        .values({ email: "alice@test.com", name: "Duplicate Alice" })
        .onConflictDoNothing()
        .returning()
    );
    // conflict on email — no row returned
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SELECT
// ---------------------------------------------------------------------------

describe("SELECT", () => {
  it("selects all rows", async () => {
    const rows = await db.select().from(users);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("filters with eq()", async () => {
    const rows = await db.select().from(users).where(eq(users.email, "alice@test.com"));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Alice");
  });

  it("executeSingle returns one row or null", async () => {
    const user = await db.executeSingle<User>(
      db.select().from(users).where(eq(users.email, "bob@test.com"))
    );
    expect(user).not.toBeNull();
    expect(user!.name).toBe("Bob");

    const missing = await db.executeSingle<User>(
      db.select().from(users).where(eq(users.email, "nobody@test.com"))
    );
    expect(missing).toBeNull();
  });

  it("filters with gt()", async () => {
    const rows = await db.select().from(users).where(gt(users.age, 28));
    // Alice (30) and Carol (40)
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const r of rows) expect(r.age!).toBeGreaterThan(28);
  });

  it("filters with and()", async () => {
    const rows = await db.select().from(users).where(and(gt(users.age, 20), eq(users.verified, false)));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.age!).toBeGreaterThan(20);
      expect(r.verified).toBe(false);
    }
  });

  it("filters with ilike()", async () => {
    const rows = await db.select().from(users).where(ilike(users.name, "%ali%"));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect((rows[0]!.name as string).toLowerCase()).toContain("ali");
  });

  it("filters with inArray()", async () => {
    const rows = await db.select().from(users).where(inArray(users.email, ["alice@test.com", "bob@test.com"]));
    expect(rows).toHaveLength(2);
  });

  it("filters with isNull() and isNotNull()", async () => {
    // Insert a user with no name
    await db.insert(users).values({ email: "noname@test.com" }).returning();

    const withNull = await db.execute<User>(
      db.select(users).where(isNull("name"))
    );
    expect(withNull.length).toBeGreaterThanOrEqual(1);
    for (const r of withNull) expect(r.name).toBeNull();

    const withName = await db.execute<User>(
      db.select(users).where(isNotNull("name"))
    );
    for (const r of withName) expect(r.name).not.toBeNull();
  });

  it("orders results", async () => {
    const rows = await db.execute<User>(
      db.select(users).where(isNotNull("age")).orderBy("age", "asc")
    );
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.age!).toBeGreaterThanOrEqual(rows[i - 1]!.age!);
    }
  });

  it("applies limit and offset", async () => {
    const page1 = await db.execute<User>(
      db.select(users).orderBy("createdAt", "asc").limit(2).offset(0)
    );
    const page2 = await db.execute<User>(
      db.select(users).orderBy("createdAt", "asc").limit(2).offset(2)
    );
    expect(page1).toHaveLength(2);
    // pages should not overlap
    const ids1 = page1.map((r) => r.id);
    const ids2 = page2.map((r) => r.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("selects specific columns", async () => {
    const rows = await db.execute<Pick<User, "id" | "email">>(
      db.select(users).select("id", "email")
    );
    expect(rows.length).toBeGreaterThan(0);
    // name should not be present
    expect((rows[0] as any).name).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

describe("UPDATE", () => {
  it("updates a row and returns it", async () => {
    const rows = await db.execute<User>(
      db.update(users)
        .set({ verified: true } as any)
        .where(eq("email", "alice@test.com"))
        .returning()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.verified).toBe(true);
  });

  it("update affects only matching rows", async () => {
    await db.execute(
      db.update(users)
        .set({ age: 99 } as any)
        .where(eq("email", "bob@test.com"))
    );
    const bob = await db.executeSingle<User>(
      db.select(users).where(eq("email", "bob@test.com"))
    );
    expect(bob!.age).toBe(99);

    // Carol's age should be unchanged
    const carol = await db.executeSingle<User>(
      db.select(users).where(eq("email", "carol@test.com"))
    );
    expect(carol!.age).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe("DELETE", () => {
  it("deletes a row and returns it", async () => {
    const rows = await db.execute<User>(
      db.delete(users)
        .where(eq("email", "noname@test.com"))
        .returning()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.email).toBe("noname@test.com");

    // confirm gone
    const check = await db.executeSingle<User>(
      db.select(users).where(eq("email", "noname@test.com"))
    );
    expect(check).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Raw SQL
// ---------------------------------------------------------------------------

describe("raw SQL", () => {
  it("executes raw SELECT", async () => {
    const rows = await db.raw<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "_bungres_test_users"`
    );
    expect(parseInt(rows[0]!.count, 10)).toBeGreaterThan(0);
  });

  it("executes raw parameterized query", async () => {
    const rows = await db.raw<User>(
      `SELECT * FROM "_bungres_test_users" WHERE email = $1`,
      ["alice@test.com"]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Alice");
  });

  it("sql tagged template works end-to-end", async () => {
    const email = "carol@test.com";
    const chunk = sql`SELECT * FROM "_bungres_test_users" WHERE email = ${email}`;
    const rows = await db.execute<User>(chunk);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Carol");
  });
});

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

describe("transactions", () => {
  it("commits when callback succeeds", async () => {
    // Get Alice's id first
    const alice = await db.executeSingle<User>(
      db.select(users).where(eq("email", "alice@test.com"))
    );

    await db.transaction(async (tx) => {
      await tx.execute(
        tx.insert(posts)
          .values({ authorId: alice!.id, title: "Hello from transaction" })
      );
    });

    const rows = await db.execute<Post>(
      db.select(posts).where(eq("title", "Hello from transaction"))
    );
    expect(rows).toHaveLength(1);
  });

  it("rolls back when callback throws", async () => {
    const before = await db.raw<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "_bungres_test_posts"`
    );
    const countBefore = parseInt(before[0]!.count, 10);

    const alice = await db.executeSingle<User>(
      db.select(users).where(eq("email", "alice@test.com"))
    );

    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          tx.insert(posts).values({ authorId: alice!.id, title: "Rolled back post" })
        );
        throw new Error("intentional rollback");
      })
    ).rejects.toThrow("intentional rollback");

    const after = await db.raw<{ count: string }>(
      `SELECT COUNT(*) AS count FROM "_bungres_test_posts"`
    );
    const countAfter = parseInt(after[0]!.count, 10);

    // Row count should be unchanged
    expect(countAfter).toBe(countBefore);
  });

  it("CASCADE delete removes child rows", async () => {
    const alice = await db.executeSingle<User>(
      db.select(users).where(eq("email", "alice@test.com"))
    );

    // Delete alice — should cascade to her posts
    await db.execute(
      db.delete(users).where(eq("id", alice!.id))
    );

    const orphanPosts = await db.execute<Post>(
      db.select(posts).where(eq("author_id", alice!.id))
    );
    expect(orphanPosts).toHaveLength(0);
  });
});
