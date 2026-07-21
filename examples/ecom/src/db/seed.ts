import { db } from "./client";
import { 
  categories, orderLines, orders, products, reviews, stores, users, 
  tags, productTags, auditLogs, brands 
} from "./schema";
import { faker } from "@faker-js/faker";

function generateLargeJson(size: number = 50) {
  const result: any = {
    history: [],
    metadata: { generatedAt: new Date().toISOString(), version: "1.0.0", environment: "production" },
    flags: {},
    tags: []
  };
  for (let i = 0; i < size; i++) {
    result.history.push({
      action: `action_${i}`,
      timestamp: new Date(Date.now() - i * 1000000).toISOString(),
      userId: Bun.randomUUIDv7(),
      changes: {
        fieldA: `old_value_${i}`,
        fieldB: `new_value_${i}`,
        nested: { key: `val_${i}`, metrics: [i, i * 2, i * 3, i * 4, i * 5] }
      },
      audit: { ip: "192.168.1.1", userAgent: "Mozilla/5.0", location: "US" }
    });
    result.flags[`flag_${i}`] = Math.random() > 0.5;
    result.tags.push(`tag_long_random_string_that_takes_up_space_${Bun.randomUUIDv7()}_${i}`);
  }
  return result;
}

async function main() {
  console.log("Starting E-commerce database seeder...");

  // Clean data
  console.log("Cleaning old data...");
  await db.raw("TRUNCATE product_tags, tags, order_lines, orders, reviews, products, brands, categories, stores, audit_logs, users CASCADE;");

  console.log("Inserting users...");
  const userIds: string[] = [];
  const userBatch = [];
  const roles = ["admin", "moderator", "user", "guest"];
  for (let i = 0; i < 500; i++) {
    const id = Bun.randomUUIDv7();
    userIds.push(id);
    userBatch.push({
      id,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      role: roles[Math.floor(Math.random() * roles.length)],
      birthDate: faker.date.birthdate().toISOString().split('T')[0],
      bio: faker.person.bio(),
      preferences: { theme: Math.random() > 0.5 ? "dark" : "light", notifications: true, language: "en-US", currency: "USD" },
    });
  }
  await db.insert(users).values(userBatch);

  console.log("Inserting categories...");
  const categoryIds: string[] = [];
  const catBatch = [];
  for (let i = 0; i < 20; i++) {
    const id = Bun.randomUUIDv7();
    categoryIds.push(id);
    const catName = faker.commerce.department();
    catBatch.push({
      id,
      name: catName,
      slug: faker.helpers.slugify(catName).toLowerCase() + `-${i}`,
      description: faker.commerce.productDescription(),
      metadata: { seoTitle: `${catName} - Shop Now`, keywords: [catName, "shop", "online"] },
    });
  }
  await db.insert(categories).values(catBatch);

  console.log("Inserting brands...");
  const brandIds: string[] = [];
  const brandBatch = [];
  for (let i = 0; i < 30; i++) {
    const id = Bun.randomUUIDv7();
    brandIds.push(id);
    const brandName = faker.company.name();
    brandBatch.push({
      id,
      name: brandName,
      slug: faker.helpers.slugify(brandName).toLowerCase() + `-${i}`,
      description: faker.company.catchPhrase(),
      logoUrl: faker.image.url(),
      websiteUrl: faker.internet.url(),
    });
  }
  await db.insert(brands).values(brandBatch);

  console.log("Inserting stores...");
  const storeIds: string[] = [];
  const storeBatch = [];
  for (let i = 0; i < 100; i++) {
    const id = Bun.randomUUIDv7();
    storeIds.push(id);
    storeBatch.push({
      id,
      ownerId: userIds[i % userIds.length]!,
      name: faker.company.name(),
      description: faker.company.catchPhrase(),
      rating: parseFloat(faker.number.float({ min: 1, max: 5, fractionDigits: 1 }).toString()),
      location: { city: faker.location.city(), country: faker.location.country() },
      businessHours: { open: "09:00", close: "17:00" },
    });
  }
  await db.insert(stores).values(storeBatch);

  console.log("Inserting products...");
  const productIds: string[] = [];
  const productBatch = [];
  const conditions = ["new", "used", "refurbished", "damaged"];
  for (let i = 0; i < 5000; i++) {
    const id = Bun.randomUUIDv7();
    productIds.push(id);
    const price = parseFloat((Math.random() * 1000).toFixed(2));
    productBatch.push({
      id,
      storeId: storeIds[i % storeIds.length]!,
      categoryId: categoryIds[i % categoryIds.length]!,
      brandId: brandIds[i % brandIds.length]!,
      sku: `SKU-${Bun.randomUUIDv7().substring(24).toUpperCase()}-${i}`,
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price,
      compareAtPrice: parseFloat((price * 1.2).toFixed(2)),
      costPrice: parseFloat((price * 0.6).toFixed(2)),
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      stock: Math.floor(Math.random() * 100),
      weight: parseFloat((Math.random() * 10).toFixed(2)),
      dimensions: { w: 10 + Math.random() * 10, h: 20 + Math.random() * 20, d: 5 + Math.random() * 5, unit: "cm" },
      images: [faker.image.url(), faker.image.url()],
      tags: ["premium", "bestseller", "featured"],
      attributes: generateLargeJson(20), // Insert large JSON payload here
    });
  }
  for (let i = 0; i < productBatch.length; i += 1000) {
    await db.insert(products).values(productBatch.slice(i, i + 1000));
  }

  console.log("Inserting reviews...");
  const reviewBatch = [];
  for (let i = 0; i < 10000; i++) {
    reviewBatch.push({
      id: Bun.randomUUIDv7(),
      productId: productIds[i % productIds.length]!,
      userId: userIds[(i + 1) % userIds.length]!,
      rating: Math.floor(Math.random() * 5) + 1,
      title: faker.word.words(3),
      comment: faker.lorem.sentences(2),
      pros: ["fast", "reliable"],
      cons: ["expensive"],
      isVerifiedPurchase: Math.random() > 0.5,
      helpfulCount: Math.floor(Math.random() * 50),
    });
  }
  for (let i = 0; i < reviewBatch.length; i += 1000) {
    await db.insert(reviews).values(reviewBatch.slice(i, i + 1000));
  }

  console.log("Inserting orders and order lines...");
  const orderBatch = [];
  const orderLineBatch = [];
  const statuses = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];
  for (let i = 0; i < 2000; i++) {
    const orderId = Bun.randomUUIDv7();
    const customerId = userIds[i % userIds.length]!;
    const totalAmt = parseFloat((Math.random() * 500).toFixed(2));
    const tax = parseFloat((totalAmt * 0.1).toFixed(2));
    const shipping = 10.00;
    const finalTotal = parseFloat((totalAmt + tax + shipping).toFixed(2));

    const status = statuses[Math.floor(Math.random() * statuses.length)];

    orderBatch.push({
      id: orderId,
      customerId,
      subtotal: totalAmt,
      tax,
      shipping,
      discount: 0,
      total: finalTotal,
      status: status,
      currency: "USD",
      notes: `Please deliver quickly for order ${i}. Handle with care.`,
      shippingAddress: generateLargeJson(2), 
      billingAddress: { line1: "123 Main St", city: "SF", zip: "94105", country: "US" },
    });

    const numItems = Math.floor(Math.random() * 5) + 1;
    for (let j = 0; j < numItems; j++) {
      const qty = Math.floor(Math.random() * 3) + 1;
      const unitPr = parseFloat((totalAmt / numItems).toFixed(2));
      const pIdx = (i + j) % productIds.length;
      orderLineBatch.push({
        id: Bun.randomUUIDv7(),
        orderId: orderId,
        productId: productIds[pIdx]!,
        quantity: qty,
        unitPrice: unitPr,
        totalPrice: parseFloat((qty * unitPr).toFixed(2)),
        productName: `Product ${pIdx}`,
        productSku: `SKU-${pIdx}`,
      });
    }
  }

  for (let i = 0; i < orderBatch.length; i += 1000) {
    await db.insert(orders).values(orderBatch.slice(i, i + 1000));
  }
  for (let i = 0; i < orderLineBatch.length; i += 1000) {
    await db.insert(orderLines).values(orderLineBatch.slice(i, i + 1000));
  }

  console.log("Inserting tags...");
  const tagIds: string[] = [];
  const tagBatch = [];
  for (let i = 0; i < 50; i++) {
    const id = Bun.randomUUIDv7();
    tagIds.push(id);
    tagBatch.push({
      id,
      name: `Tag ${i}`,
      slug: `tag-${i}`,
      color: "#ff0000",
      description: `Tag description ${i}`,
    });
  }
  await db.insert(tags).values(tagBatch);

  console.log("Inserting product tags...");
  const productTagBatch = [];
  for (let i = 0; i < productIds.length; i++) {
    const numTags = Math.floor(Math.random() * 4);
    for (let j = 0; j < numTags; j++) {
      productTagBatch.push({
        id: Bun.randomUUIDv7(),
        productId: productIds[i]!,
        tagId: tagIds[(i + j) % tagIds.length]!,
      });
    }
  }
  for (let i = 0; i < productTagBatch.length; i += 1000) {
    await db.insert(productTags).values(productTagBatch.slice(i, i + 1000));
  }

  console.log("Inserting audit logs...");
  const logBatch = [];
  const levels = ["debug", "info", "warn", "error", "fatal"];
  for (let i = 0; i < 50; i++) {
    logBatch.push({
      id: Bun.randomUUIDv7(),
      level: levels[Math.floor(Math.random() * levels.length)],
      action: "order.created",
      message: `System event ${i}`,
      userId: userIds[i % userIds.length],
      targetResource: "orders",
      targetId: Bun.randomUUIDv7(),
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      meta: { service: "order-service", eventId: i },
    });
  }
  await db.insert(auditLogs).values(logBatch);

  console.log("Refreshing materialized views...");
  await db.raw("REFRESH MATERIALIZED VIEW daily_sales_mv;");
  await db.raw("REFRESH MATERIALIZED VIEW top_selling_products_mv;");

  console.log("✅ Seeding completed! Database is primed for testing.");
}

main().catch(err => {
  console.error("Seeding failed", err);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
