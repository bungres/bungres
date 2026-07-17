import { db } from "./db/client";
import * as schema from "./db/schema";
import { sql } from "@bungres/orm";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

async function run() {
  console.log("🚀 Starting Bungres Mass Data Seeder...\n");

  // Clean up existing data for a fresh run
  console.log("🧹 Cleaning up old data...");
  await db.execute(db.delete(schema.users).comment("Clean up users"));
  await db.execute(db.delete(schema.categories));
  await db.execute(db.delete(schema.tags));

  // 1. Insert 100 Users
  console.log("📝 Inserting 100 Users...");
  const usersToInsert = Array.from({ length: 100 }).map((_, i) => ({
    name: `User ${i}`,
    email: `user${i}@example.com`,
  }));
  const users = await db.insert(schema.users).values(usersToInsert).returning();

  // 2. Insert 20 Stores
  console.log("📝 Inserting 20 Stores...");
  const storesToInsert = Array.from({ length: 20 }).map((_, i) => ({
    ownerId: randomItem(users).id,
    name: `Store ${i}`,
  }));
  const stores = await db.insert(schema.stores).values(storesToInsert).returning();

  // 3. Insert 50 Categories
  console.log("📝 Inserting 50 Categories...");
  const categoriesToInsert = Array.from({ length: 50 }).map((_, i) => ({
    name: `Category ${i}`,
    description: `Description for Category ${i}`,
  }));
  const categories = await db.insert(schema.categories).values(categoriesToInsert).returning();

  // 4. Insert 100 Tags
  console.log("📝 Inserting 100 Tags...");
  const tagsToInsert = Array.from({ length: 100 }).map((_, i) => ({
    name: `Tag ${i}`,
  }));
  const tags = await db.insert(schema.tags).values(tagsToInsert).returning();

  // 5. Insert 5000 Products
  console.log("📝 Inserting 5,000 Products...");
  const productsToInsert = Array.from({ length: 5000 }).map((_, i) => ({
    storeId: randomItem(stores).id,
    categoryId: randomItem(categories).id,
    name: `Product ${i}`,
    price: randomInt(10, 1000),
    stock: randomInt(0, 100),
  }));
  // Chunking to avoid parameter limits in Postgres
  const products: any[] = [];
  for (let i = 0; i < productsToInsert.length; i += 1000) {
    const chunk = productsToInsert.slice(i, i + 1000);
    const chunkRes = await db.insert(schema.products).values(chunk).returning();
    products.push(...chunkRes);
  }

  // 6. Insert Product Tags (Many-to-Many)
  console.log("📝 Linking Products to Tags (Many-to-Many)...");
  const productTagsToInsert = products.flatMap(p => {
    // Each product gets 1 to 3 tags
    const numTags = randomInt(1, 3);
    const selectedTags = new Set<string>();
    while (selectedTags.size < numTags) {
      selectedTags.add(randomItem(tags).id);
    }
    return Array.from(selectedTags).map(tagId => ({
      productId: p.id,
      tagId: tagId,
    }));
  });
  
  for (let i = 0; i < productTagsToInsert.length; i += 5000) {
    const chunk = productTagsToInsert.slice(i, i + 5000);
    await db.insert(schema.productTags).values(chunk);
  }

  // 7. Insert 10,000 Reviews
  console.log("📝 Inserting 10,000 Reviews...");
  const reviewsToInsert = Array.from({ length: 10000 }).map((_, i) => ({
    productId: randomItem(products).id,
    userId: randomItem(users).id,
    rating: randomInt(1, 5),
    comment: `This is a review ${i} for a product.`,
  }));
  for (let i = 0; i < reviewsToInsert.length; i += 2000) {
    const chunk = reviewsToInsert.slice(i, i + 2000);
    await db.insert(schema.reviews).values(chunk);
  }

  // 8. Insert 2,000 Orders
  console.log("📝 Inserting 2,000 Orders...");
  const ordersToInsert = Array.from({ length: 2000 }).map((_, i) => ({
    userId: randomItem(users).id,
    total: randomInt(50, 5000),
    status: randomItem(["pending", "completed", "cancelled", "shipped"]),
  }));
  const orders: any[] = [];
  for (let i = 0; i < ordersToInsert.length; i += 1000) {
    const chunk = ordersToInsert.slice(i, i + 1000);
    const chunkRes = await db.insert(schema.orders).values(chunk).returning();
    orders.push(...chunkRes);
  }

  // 9. Insert 5,000 Order Items
  console.log("📝 Inserting 5,000 Order Items...");
  const orderItemsToInsert = Array.from({ length: 5000 }).map((_, i) => ({
    orderId: randomItem(orders).id,
    productId: randomItem(products).id,
    quantity: randomInt(1, 5),
    price: randomInt(10, 1000),
  }));
  for (let i = 0; i < orderItemsToInsert.length; i += 2000) {
    const chunk = orderItemsToInsert.slice(i, i + 2000);
    await db.insert(schema.orderItems).values(chunk);
  }

  console.log("\n✅ Seeding Complete!");
  
  const totalProducts = await db.execute<{count: string}>(sql`SELECT COUNT(*) as count FROM "products"`);
  const totalReviews = await db.execute<{count: string}>(sql`SELECT COUNT(*) as count FROM "reviews"`);
  console.log(`Total Products seeded: ${totalProducts[0]?.count}`);
  console.log(`Total Reviews seeded: ${totalReviews[0]?.count}`);

  process.exit(0);
}

run().catch((err) => {
  console.error("Error seeding data:", err);
  process.exit(1);
});
