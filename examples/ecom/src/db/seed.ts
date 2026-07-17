import { db } from "./client";
import { categories, orderItems, orders, products, reviews, stores, users } from "./schema";

async function main() {
  console.log("Starting E-commerce database seeder...");

  // Clean data
  console.log("Cleaning old data...");
  await db.raw("TRUNCATE order_items, orders, reviews, products, categories, stores, users CASCADE;");

  console.log("Inserting users...");
  const userIds: string[] = [];
  const userBatch = [];
  for (let i = 0; i < 500; i++) {
    const id = crypto.randomUUID();
    userIds.push(id);
    userBatch.push({
      id,
      name: `User ${i}`,
      email: `user${i}@example.com`,
    });
  }
  await db.insert(users).values(userBatch);

  console.log("Inserting categories...");
  const categoryIds: string[] = [];
  const catBatch = [];
  for (let i = 0; i < 20; i++) {
    const id = crypto.randomUUID();
    categoryIds.push(id);
    catBatch.push({
      id,
      name: `Category ${i}`,
    });
  }
  await db.insert(categories).values(catBatch);

  console.log("Inserting stores...");
  const storeIds: string[] = [];
  const storeBatch = [];
  for (let i = 0; i < 100; i++) {
    const id = crypto.randomUUID();
    storeIds.push(id);
    storeBatch.push({
      id,
      ownerId: userIds[i % userIds.length]!,
      name: `Store ${i}`,
    });
  }
  await db.insert(stores).values(storeBatch);

  console.log("Inserting products...");
  const productIds: string[] = [];
  const productBatch = [];
  for (let i = 0; i < 5000; i++) {
    const id = crypto.randomUUID();
    productIds.push(id);
    productBatch.push({
      id,
      storeId: storeIds[i % storeIds.length]!,
      categoryId: categoryIds[i % categoryIds.length]!,
      name: `Product ${i}`,
      price: parseFloat((Math.random() * 1000).toFixed(2)),
      stock: Math.floor(Math.random() * 100),
    });
  }
  // Insert in chunks of 1000
  for (let i = 0; i < productBatch.length; i += 1000) {
    await db.insert(products).values(productBatch.slice(i, i + 1000));
  }

  console.log("Inserting reviews...");
  const reviewBatch = [];
  for (let i = 0; i < 10000; i++) {
    reviewBatch.push({
      id: crypto.randomUUID(),
      productId: productIds[i % productIds.length]!,
      userId: userIds[(i + 1) % userIds.length]!,
      rating: Math.floor(Math.random() * 5) + 1,
      comment: "Great product!",
    });
  }
  for (let i = 0; i < reviewBatch.length; i += 1000) {
    await db.insert(reviews).values(reviewBatch.slice(i, i + 1000));
  }

  console.log("Inserting orders and order items...");
  const orderBatch = [];
  const orderItemBatch = [];
  for (let i = 0; i < 2000; i++) {
    const orderId = crypto.randomUUID();
    orderBatch.push({
      id: orderId,
      userId: userIds[i % userIds.length]!,
      total: parseFloat((Math.random() * 500).toFixed(2)),
      status: "completed",
    });

    const numItems = Math.floor(Math.random() * 5) + 1;
    for (let j = 0; j < numItems; j++) {
      orderItemBatch.push({
        id: crypto.randomUUID(),
        orderId: orderId,
        productId: productIds[(i + j) % productIds.length]!,
        quantity: Math.floor(Math.random() * 3) + 1,
        price: parseFloat((Math.random() * 100).toFixed(2)),
      });
    }
  }

  for (let i = 0; i < orderBatch.length; i += 1000) {
    await db.insert(orders).values(orderBatch.slice(i, i + 1000));
  }
  for (let i = 0; i < orderItemBatch.length; i += 1000) {
    await db.insert(orderItems).values(orderItemBatch.slice(i, i + 1000));
  }

  console.log("✅ Seeding completed! Database is primed for benchmarking.");
}

main().catch(err => {
  console.error("Seeding failed", err);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
