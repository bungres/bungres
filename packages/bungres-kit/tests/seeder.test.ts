import { describe, expect, test } from "bun:test";
import { defineSeed, createFakeGenerator, createRelGenerator } from "../src/seeder.js";

describe("defineSeed & Fluent Blueprint API", () => {
  test("creates table blueprints with chainable methods", () => {
    const fakeSchema = {
      users: { name: "users", columns: { id: { dataType: "uuid" } } },
    };

    const seedDef = defineSeed(null, fakeSchema, (seed) => {
      seed.truncate();

      seed.table("users")
        .count(150)
        .columns({
          email: seed.fake.email(),
          role: seed.fake.values(["admin", "user"], [10, 90]),
        });
    });

    expect(seedDef.shouldTruncateAll).toBe(true);
    expect(seedDef.blueprints.has("users")).toBe(true);

    const bp = seedDef.blueprints.get("users")!;
    expect(bp._count).toBe(150);
    expect(typeof bp._columns.email).toBe("function");
    expect(typeof bp._columns.role).toBe("function");
  });

  test("seed.fake.values supports weighted distribution", () => {
    const fake = createFakeGenerator();
    const picker = fake.values(["A", "B"], [100, 0]); // 100% A

    for (let i = 0; i < 10; i++) {
      expect(picker(i)).toBe("A");
    }
  });

  test("seed.rel.parent creates relation descriptor", () => {
    const rel = createRelGenerator();
    const ref = rel.parent("users", "id");
    expect(ref.__isRel).toBe(true);
    expect(ref.tableName).toBe("users");
    expect(ref.colName).toBe("id");
  });
});
