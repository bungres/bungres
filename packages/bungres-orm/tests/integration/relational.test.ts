import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { bungres, pgTable, text, uuid } from "../../src/index.js";

const DB_URL = Bun.env.DATABASE_URL;

if (!DB_URL) {
  console.log("  ⚠  Skipping relational tests — no DATABASE_URL set.");
}

const runTests = !!DB_URL;

if (runTests) {

  const users = pgTable("_bungres_rel_users", {
    id: uuid("id", { primaryKey: true }),
    name: text("name", { notNull: true }),
  });

  const profiles = pgTable("_bungres_rel_profiles", {
    id: uuid("id", { primaryKey: true }),
    userId: uuid("user_id", { notNull: true, unique: true, references: { table: "users" as const, column: "id", relationName: "profile", backRelationName: "profile" } }),
    bio: text("bio"),
  });

  const posts = pgTable("_bungres_rel_posts", {
    id: uuid("id", { primaryKey: true }),
    userId: uuid("user_id", { notNull: true, references: { table: "users" as const, column: "id", relationName: "user", backRelationName: "posts" } }),
    title: text("title", { notNull: true }),
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

  const schema = { users, profiles, posts, groups, userGroups };
  const db = bungres({ url: DB_URL, schema });

  beforeAll(async () => {
    await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_user_groups"`);
    await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_groups"`);
    await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_posts"`);
    await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_profiles"`);
    await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_users"`);

    await db.raw(`
    CREATE TABLE IF NOT EXISTS "_bungres_rel_users" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL
    )
  `);
    await db.raw(`
    CREATE TABLE IF NOT EXISTS "_bungres_rel_profiles" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES "_bungres_rel_users"(id) ON DELETE CASCADE,
      bio TEXT
    )
  `);
    await db.raw(`
    CREATE TABLE IF NOT EXISTS "_bungres_rel_posts" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES "_bungres_rel_users"(id) ON DELETE CASCADE,
      title TEXT NOT NULL
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
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_user_groups"`);
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_groups"`);
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_posts"`);
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_profiles"`);
    // await db.raw(`DROP TABLE IF EXISTS "_bungres_rel_users"`);
    await db.close();
  });

  describe("Relational API - One-to-One", () => {
    it("resolves one-to-one relationships implicitly", async () => {
      const [u] = await db.insert(users).values({ name: "Charlie" }).returning();
      await db.insert(profiles).values({ userId: u!.id, bio: "Developer" });

      const result = await db.users.findFirst({
        where: { id: u!.id },
        with: {
          profile: true,
        }
      });

      expect(result).toBeDefined();
      // @ts-ignore
      expect(result!.profile).toBeDefined();
      // @ts-ignore
      expect(result!.profile[0].bio).toBe("Developer");
    });
  });

  describe("Relational API - One-to-Many", () => {
    it("resolves one-to-many relationships implicitly", async () => {
      const [u] = await db.insert(users).values({ name: "Diana" }).returning();
      await db.insert(posts).values([
        { userId: u!.id, title: "Post 1" },
        { userId: u!.id, title: "Post 2" },
      ]);

      const result = await db.users.findFirst({
        where: { id: u!.id },
        with: {
          posts: true,
        }
      });

      expect(result).toBeDefined();
      // @ts-ignore
      expect(result!.posts).toBeDefined();
      // @ts-ignore
      expect(result!.posts).toHaveLength(2);
      // @ts-ignore
      const titles = result!.posts.map((p: any) => p.title);
      expect(titles).toContain("Post 1");
      expect(titles).toContain("Post 2");
    });
  });
}
