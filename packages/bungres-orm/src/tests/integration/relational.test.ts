import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { bungres, pgTable, text, uuid } from "../../index.js";

const DB_URL = Bun.env.DATABASE_URL;

if (!DB_URL) {
  console.log("  ⚠  Skipping relational tests — no DATABASE_URL set.");
  process.exit(0);
}

const users = pgTable("_bungres_rel_users", {
  id: uuid("id", { primaryKey: true }),
  name: text("name", { notNull: true }),
});

const groups = pgTable("_bungres_rel_groups", {
  id: uuid("id", { primaryKey: true }),
  name: text("name", { notNull: true }),
});

const userGroups = pgTable("_bungres_rel_user_groups", {
  id: uuid("id", { primaryKey: true }),
  userId: uuid("user_id", { notNull: true, references: { table: "users" as const, column: "id", relationName: "user" } }),
  groupId: uuid("group_id", { notNull: true, references: { table: "groups" as const, column: "id", relationName: "group" } }),
});

const schema = { users, groups, userGroups };
const db = bungres({ url: DB_URL, schema });

beforeAll(async () => {
  await db.raw(`
    CREATE TABLE IF NOT EXISTS "_bungres_rel_users" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL
    )
  `);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS "_bungres_rel_groups" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL
    )
  `);
  await db.raw(`
    CREATE TABLE IF NOT EXISTS "_bungres_rel_user_groups" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "_bungres_rel_users"(id) ON DELETE CASCADE,
      group_id UUID NOT NULL REFERENCES "_bungres_rel_groups"(id) ON DELETE CASCADE
    )
  `);
});

afterAll(async () => {
  await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_user_groups"`);
  await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_groups"`);
  await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_users"`);
  await db.close();
});

describe("Relational API - Many-to-Many", () => {
  it("resolves deep many-to-many relationships implicitly", async () => {
    // 1. Setup Data
    const [u1] = await db.insert(users).values({ name: "Alice" }).returning();
    const [u2] = await db.insert(users).values({ name: "Bob" }).returning();

    const [g1] = await db.insert(groups).values({ name: "Admins" }).returning();
    const [g2] = await db.insert(groups).values({ name: "Editors" }).returning();

    await db.insert(userGroups).values([
      { userId: u1!.id, groupId: g1!.id },
      { userId: u1!.id, groupId: g2!.id },
      { userId: u2!.id, groupId: g2!.id },
    ]);

    // 2. Query many-to-many
    const result = await db.users.findMany({
      with: {
        groups: true,
      }
    });

    // 3. Verify
    expect(result.length).toBeGreaterThanOrEqual(2);
    const alice = result.find(u => u.name === "Alice");
    const bob = result.find(u => u.name === "Bob");

    expect(alice).toBeDefined();
    // @ts-ignore: dynamic relation inference needs manual typing hint or advanced TS 5.0+ const generics
    expect(alice!.groups).toHaveLength(2);
    // @ts-ignore
    const aliceGroupNames = alice!.groups.map((g: any) => g.name);
    expect(aliceGroupNames).toContain("Admins");
    expect(aliceGroupNames).toContain("Editors");

    expect(bob).toBeDefined();
    // @ts-ignore
    expect(bob!.groups).toHaveLength(1);
    // @ts-ignore
    expect(bob!.groups[0].name).toBe("Editors");
  });
});
