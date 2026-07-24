import { defineSeed } from "@bungres/kit";
import { db } from "./client";
import * as schema from "./schema";

const CATEGORIES = [
  { name: "Electronics & Gadgets", slug: "electronics-gadgets" },
  { name: "Clothing & Apparel", slug: "clothing-apparel" },
  { name: "Home & Kitchen", slug: "home-kitchen" },
  { name: "Books & Stationery", slug: "books-stationery" },
  { name: "Beauty & Personal Care", slug: "beauty-personal-care" },
  { name: "Sports & Outdoors", slug: "sports-outdoors" },
  { name: "Toys & Games", slug: "toys-games" },
  { name: "Automotive & Tools", slug: "automotive-tools" },
  { name: "Jewelry & Watches", slug: "jewelry-watches" },
  { name: "Health & Wellness", slug: "health-wellness" },
];

const BRANDS = [
  "Apple", "Samsung", "Sony", "Nike", "Adidas",
  "Logitech", "Bose", "Dyson", "Puma", "Anker",
  "LG", "Dell", "HP", "Asus", "Canon",
  "Panasonic", "Lenovo", "Philips", "JBL", "Seagate"
];

const PRODUCT_TITLES = [
  "Wireless Noise-Canceling Headphones",
  "Ergonomic Mechanical RGB Gaming Keyboard",
  "Ultra-Wide 34-Inch 4K Curved Monitor",
  "Insulated Stainless Steel Water Bottle 1L",
  "Organic Dark Roast Espresso Coffee Beans 1kg",
  "Lightweight Breathable Running Shoes",
  "Waterproof Smartwatch Fitness Tracker",
  "Digital Air Fryer XL 5.5L Convection Oven",
  "Professional Mirrorless Digital Camera Kit",
  "High-Speed Tri-Band Wi-Fi 6 Router",
  "Genuine Leather RFID Blocking Slim Wallet",
  "Portable Rugged Bluetooth Speaker",
  "Electric Height-Adjustable Standing Desk",
  "Contour Memory Foam Orthopedic Pillow",
  "Damascus Steel Japanese Chef Knife Set"
];

const REVIEWS = [
  { title: "Exceptional build quality!", comment: "Exceeded my expectations. The build quality is top-notch and battery life easily lasts two days." },
  { title: "Fantastic value for money", comment: "Works exactly as advertised. Fast delivery and well-protected packaging." },
  { title: "Great product, quick shipping", comment: "Super convenient and easy to set up out of the box. Highly satisfied." },
  { title: "Highly recommended for daily use", comment: "I have been using this daily for two weeks now and have zero complaints." },
  { title: "Sleek design & premium feel", comment: "Looks sleek on my desk and feels very premium. Definitely worth the price." }
];

const TAGS = [
  { name: "Bestseller", slug: "bestseller" },
  { name: "New Arrival", slug: "new-arrival" },
  { name: "On Sale", slug: "on-sale" },
  { name: "Top Rated", slug: "top-rated" },
  { name: "Free Shipping", slug: "free-shipping" },
  { name: "Eco Friendly", slug: "eco-friendly" },
  { name: "Limited Edition", slug: "limited-edition" },
  { name: "Trending", slug: "trending" },
];

const AUDIT_ACTIONS = [
  { action: "user.login", msg: "User authenticated successfully from registered device" },
  { action: "order.created", msg: "New customer order placed and sent to fulfillment center" },
  { action: "payment.processed", msg: "Credit card payment authorized via Stripe Gateway" },
  { action: "product.updated", msg: "Inventory stock counts updated after bulk restock" },
  { action: "user.password_reset", msg: "Password reset token generated and dispatched via email" },
];

const seedDef = defineSeed(db, schema, (seed) => {
  // Truncate all tables before seeding
  seed.truncate();

  // 1. Users blueprint
  seed.table("users")
    .count(100)
    .columns({
      email: seed.fake.email(),
      name: seed.fake.fullName(),
      role: seed.fake.values(["admin", "moderator", "user", "guest"], [5, 10, 80, 5]),
      isActive: seed.fake.boolean({ truePercentage: 90 }),
      bio: seed.fake.values([
        "Tech enthusiast, coffee lover, and software developer.",
        "Passionate gamer and hardware optimizer.",
        "E-commerce shopper and gadget reviewer.",
        "Design enthusiast and creative photographer."
      ]),
    });

  // 2. Categories blueprint
  seed.table("categories")
    .count(CATEGORIES.length)
    .columns({
      name: seed.fake.custom((i) => CATEGORIES[i % CATEGORIES.length]!.name),
      slug: seed.fake.custom((i) => CATEGORIES[i % CATEGORIES.length]!.slug),
      description: seed.fake.custom((i) => `Browse top-rated products in ${CATEGORIES[i % CATEGORIES.length]!.name}.`),
    });

  // 3. Brands blueprint
  seed.table("brands")
    .count(BRANDS.length)
    .columns({
      name: seed.fake.custom((i) => BRANDS[i % BRANDS.length]!),
      slug: seed.fake.custom((i) => BRANDS[i % BRANDS.length]!.toLowerCase().replace(/\s+/g, "-")),
      description: seed.fake.custom((i) => `Official store for ${BRANDS[i % BRANDS.length]!} premium products.`),
      logoUrl: seed.fake.custom((i) => `https://images.unsplash.com/photo-${1500000000000 + i}?w=200&h=200&fit=crop`),
    });

  // 4. Stores blueprint
  seed.table("stores")
    .count(30)
    .columns({
      name: seed.fake.custom((i) => `${BRANDS[i % BRANDS.length]!} Official Flagship Store ${i + 1}`),
      rating: seed.fake.number({ min: 4.0, max: 5.0, precision: 1 }),
      description: seed.fake.custom((i) => `Authorized flagship seller of ${BRANDS[i % BRANDS.length]!} electronics & lifestyle gear.`),
    });

  // 5. Products blueprint
  seed.table("products")
    .count(250)
    .columns({
      name: seed.fake.custom((i) => `${BRANDS[i % BRANDS.length]!} ${PRODUCT_TITLES[i % PRODUCT_TITLES.length]!}`),
      sku: seed.fake.custom((i) => `SKU-${BRANDS[i % BRANDS.length]!.slice(0, 3).toUpperCase()}-${1000 + i}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`),
      price: seed.fake.number({ min: 19.99, max: 899.99, precision: 2 }),
      compareAtPrice: seed.fake.number({ min: 29.99, max: 1199.99, precision: 2 }),
      costPrice: seed.fake.number({ min: 10.00, max: 400.00, precision: 2 }),
      stock: seed.fake.number({ min: 5, max: 250 }),
      condition: seed.fake.values(["new", "used", "refurbished", "damaged"], [80, 10, 8, 2]),
      images: seed.fake.custom((i) => [
        `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop`,
        `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop`
      ]),
    });

  // 6. Reviews blueprint
  seed.table("reviews")
    .count(300)
    .columns({
      title: seed.fake.custom((i) => REVIEWS[i % REVIEWS.length]!.title),
      comment: seed.fake.custom((i) => REVIEWS[i % REVIEWS.length]!.comment),
      rating: seed.fake.values([5, 4, 3, 2, 1], [60, 25, 10, 3, 2]),
      isVerifiedPurchase: seed.fake.boolean({ truePercentage: 85 }),
    });

  // 7. Orders blueprint
  seed.table("orders")
    .count(150)
    .columns({
      status: seed.fake.values(["pending", "processing", "shipped", "delivered", "cancelled"], [10, 20, 25, 40, 5]),
      subtotal: seed.fake.number({ min: 29.99, max: 599.99, precision: 2 }),
      tax: seed.fake.number({ min: 2.50, max: 50.00, precision: 2 }),
      shipping: 9.99,
      total: seed.fake.number({ min: 42.48, max: 659.98, precision: 2 }),
      currency: "USD",
      notes: seed.fake.values([
        "Please deliver during business hours.",
        "Leave at front porch if nobody answers.",
        "Handle with care (Fragile items inside).",
        "Call customer prior to delivery."
      ]),
    });

  // 8. Order Lines blueprint
  seed.table("order_lines")
    .count(350)
    .columns({
      quantity: seed.fake.number({ min: 1, max: 3 }),
      unitPrice: seed.fake.number({ min: 19.99, max: 299.99, precision: 2 }),
      totalPrice: seed.fake.number({ min: 19.99, max: 899.97, precision: 2 }),
      productName: seed.fake.custom((i) => PRODUCT_TITLES[i % PRODUCT_TITLES.length]!),
    });

  // 9. Tags blueprint
  seed.table("tags")
    .count(TAGS.length)
    .columns({
      name: seed.fake.custom((i) => TAGS[i % TAGS.length]!.name),
      slug: seed.fake.custom((i) => TAGS[i % TAGS.length]!.slug),
    });

  // 10. Product Tags junction blueprint
  seed.table("product_tags")
    .count(250);

  // 11. Audit Logs blueprint
  seed.table("audit_logs")
    .count(100)
    .columns({
      level: seed.fake.values(["info", "warn", "error", "debug"], [70, 15, 10, 5]),
      action: seed.fake.custom((i) => AUDIT_ACTIONS[i % AUDIT_ACTIONS.length]!.action),
      message: seed.fake.custom((i) => AUDIT_ACTIONS[i % AUDIT_ACTIONS.length]!.msg),
      ipAddress: seed.fake.values(["192.168.1.100", "10.0.0.15", "172.16.0.42"]),
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
});

export default seedDef;

if (import.meta.main) {
  seedDef.execute().then(() => {
    process.exit(0);
  }).catch((err: any) => {
    console.error("Seeding error:", err);
    process.exit(1);
  });
}
