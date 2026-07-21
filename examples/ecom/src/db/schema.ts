import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum, pgMaterializedView,
  pgTable,
  serial,
  sql,
  text,
  textArray,
  timestamptz,
  unique,
  uuid,
  varchar
} from "@bungres/orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "moderator", "user", "guest"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]);
export const productConditionEnum = pgEnum("product_condition", ["new", "used", "refurbished", "damaged"]);
export const auditLogLevelEnum = pgEnum("audit_log_level", ["debug", "info", "warn", "error", "fatal"]);

export const users = pgTable("users", {
  id: uuid({ primaryKey: true }),
  name: varchar({ length: 255, notNull: true }),
  email: varchar({ length: 255, notNull: true }),
  role: userRoleEnum({ notNull: true, default: "user" }),
  isActive: boolean({ notNull: true, default: true }),
  birthDate: date(),
  bio: text(),
  preferences: jsonb(),
  lastLoginAt: timestamptz(),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
  updatedAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    unique().on(t.email),
    index().on(t.email),
    index().on(t.role),
    index().on(t.isActive),
  ]);

export const stores = pgTable("stores", {
  id: uuid({ primaryKey: true }),
  ownerId: uuid({ notNull: true, references: { table: "users", column: "id", onDelete: "cascade", relationName: "owner", backRelationName: "stores" } }),
  name: varchar({ length: 255, notNull: true }),
  description: text(),
  isActive: boolean({ notNull: true, default: true }),
  rating: numeric(),
  location: jsonb(),
  businessHours: jsonb(),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
  updatedAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    index().on(t.ownerId),
    index().on(t.isActive),
  ]);

export const categories = pgTable("categories", {
  id: uuid({ primaryKey: true }),
  name: varchar({ length: 100, notNull: true }),
  description: text(),
  slug: varchar({ length: 100, unique: true }),
  parentId: uuid({ references: { table: "categories", column: "id", onDelete: "set null" } }),
  isActive: boolean({ notNull: true, default: true }),
  sortOrder: integer({ default: 0 }),
  metadata: jsonb(),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    index().on(t.name),
    index().on(t.slug),
    index().on(t.parentId),
  ]);

export const brands = pgTable("brands", {
  id: uuid({ primaryKey: true }),
  name: varchar({ length: 100, notNull: true }),
  slug: varchar({ length: 100, unique: true }),
  description: text(),
  logoUrl: varchar({ length: 255 }),
  websiteUrl: varchar({ length: 255 }),
  isActive: boolean({ notNull: true, default: true }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    index().on(t.name),
    index().on(t.slug),
  ]);

export const products = pgTable("products", {
  id: uuid({ primaryKey: true }),
  storeId: uuid({ notNull: true, references: { table: "stores", column: "id", onDelete: "cascade", relationName: "store", backRelationName: "products" } }),
  categoryId: uuid({ notNull: true, references: { table: "categories", column: "id", onDelete: "cascade", relationName: "category", backRelationName: "products" } }),
  brandId: uuid({ references: { table: "brands", column: "id", onDelete: "set null", relationName: "brand", backRelationName: "products" } }),
  sku: varchar({ length: 50, unique: true }),
  name: varchar({ length: 255, notNull: true }),
  description: text(),
  price: numeric({ notNull: true }),
  compareAtPrice: numeric(),
  costPrice: numeric(),
  condition: productConditionEnum({ default: "new" }),
  stock: integer({ notNull: true, default: 0 }),
  lowStockThreshold: integer({ default: 10 }),
  weight: numeric(),
  dimensions: jsonb(),
  images: textArray(),
  tags: textArray(),
  attributes: jsonb(),
  isActive: boolean({ notNull: true, default: true }),
  publishedAt: timestamptz(),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
  updatedAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    index().on(t.storeId),
    index().on(t.categoryId),
    index().on(t.brandId),
    index().on(t.name),
    index().on(t.sku),
    index().on(t.price),
    index().on(t.isActive),
    index().on(t.condition),
  ]);

export const reviews = pgTable("reviews", {
  id: uuid({ primaryKey: true }),
  productId: uuid({ notNull: true, references: { table: "products", column: "id", onDelete: "cascade", relationName: "product", backRelationName: "reviews" } }),
  userId: uuid({ notNull: true, references: { table: "users", column: "id", onDelete: "cascade", relationName: "author", backRelationName: "reviews" } }),
  rating: integer({ notNull: true }),
  title: varchar({ length: 255 }),
  comment: text(),
  pros: textArray(),
  cons: textArray(),
  isVerifiedPurchase: boolean({ default: false }),
  isRecommended: boolean({ default: true }),
  helpfulCount: integer({ default: 0 }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
  updatedAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    index().on(t.productId),
    index().on(t.userId),
    index().on(t.rating),
    index().on(t.createdAt),
  ]);

export const orders = pgTable("orders", {
  id: uuid({ primaryKey: true }),
  orderNumber: serial({ primaryKey: false }),
  customerId: uuid({ notNull: true, references: { table: "users", column: "id", onDelete: "cascade", relationName: "customer", backRelationName: "orders" } }),
  status: orderStatusEnum({ notNull: true, default: "pending" }),
  subtotal: numeric({ notNull: true }),
  tax: numeric({ default: 0 }),
  shipping: numeric({ default: 0 }),
  discount: numeric({ default: 0 }),
  total: numeric({ notNull: true }),
  currency: varchar({ length: 3, default: "USD" }),
  notes: text(),
  shippingAddress: jsonb(),
  billingAddress: jsonb(),
  shippedAt: timestamptz(),
  deliveredAt: timestamptz(),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
  updatedAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    index().on(t.customerId),
    index().on(t.orderNumber),
    index().on(t.status),
    index().on(t.createdAt),
  ]);

export const orderLines = pgTable("order_lines", {
  id: uuid({ primaryKey: true }),
  orderId: uuid({ notNull: true, references: { table: "orders", column: "id", onDelete: "cascade", relationName: "order", backRelationName: "lines" } }),
  productId: uuid({ notNull: true, references: { table: "products", column: "id", onDelete: "restrict", relationName: "product", backRelationName: "orderLines" } }),
  quantity: integer({ notNull: true }),
  unitPrice: numeric({ notNull: true }),
  totalPrice: numeric({ notNull: true }),
  productName: varchar({ length: 255 }),
  productSku: varchar({ length: 50 }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    index().on(t.orderId),
    index().on(t.productId),
  ]);

export const tags = pgTable("tags", {
  id: uuid({ primaryKey: true }),
  name: varchar({ length: 50, notNull: true, unique: true }),
  slug: varchar({ length: 50, unique: true }),
  color: varchar({ length: 7 }),
  description: text(),
  isActive: boolean({ default: true }),
  usageCount: integer({ default: 0 }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    unique().on(t.name),
    index().on(t.slug),
  ]);

export const productTags = pgTable("product_tags", {
  id: uuid({ primaryKey: true }),
  productId: uuid({ notNull: true, references: { table: "products", column: "id", onDelete: "cascade" } }),
  tagId: uuid({ notNull: true, references: { table: "tags", column: "id", onDelete: "cascade" } }),
},
  (t) => [
    unique().on(t.productId, t.tagId),
  ]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid({ primaryKey: true }),
  level: auditLogLevelEnum({ notNull: true }),
  action: varchar({ length: 100, notNull: true }),
  message: text({ notNull: true }),
  userId: uuid({ references: { table: "users", column: "id", onDelete: "set null" } }),
  targetResource: varchar({ length: 100 }),
  targetId: uuid(),
  ipAddress: varchar({ length: 45 }),
  userAgent: text(),
  meta: jsonb(),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
},
  (t) => [
    index().on(t.level),
    index().on(t.action),
    index().on(t.userId),
    index().on(t.targetResource, t.targetId),
    index().on(t.createdAt),
  ]);

// E-commerce Materialized Views for complex queries
export const dailySalesView = pgMaterializedView("daily_sales_mv", {
  toSQL: () => sql`
    SELECT
      DATE_TRUNC('day', created_at) as sale_date,
      COUNT(id) as total_orders,
      SUM(total) as total_revenue,
      SUM(discount) as total_discounts
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY DATE_TRUNC('day', created_at)
  `
});

export const topSellingProductsView = pgMaterializedView("top_selling_products_mv", {
  toSQL: () => sql`
    SELECT
      p.id as product_id,
      p.name as product_name,
      COUNT(ol.id) as times_ordered,
      SUM(ol.quantity) as total_quantity_sold,
      SUM(ol.total_price) as total_revenue
    FROM order_lines ol
    JOIN products p ON ol.product_id = p.id
    JOIN orders o ON ol.order_id = o.id
    WHERE o.status != 'cancelled'
    GROUP BY p.id, p.name
  `
});
