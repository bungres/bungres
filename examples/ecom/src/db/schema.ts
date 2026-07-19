import {
  index,
  integer,
  jsonb,
  numeric,
  table,
  text,
  textArray,
  timestamptz,
  unique,
  uuid,
  varchar,
  boolean
} from "@bungres/orm";

export const users = table("users", {
  id: uuid({ primaryKey: true }),
  name: varchar({ length: 255, notNull: true }),
  email: varchar({ length: 255, notNull: true }),
  bio: text(),
  isActive: boolean({ default: true }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
}, (t) => [
  unique().on(t.email),
  index().on(t.email),
  index().on(t.name),
]);

export const stores = table("stores", {
  id: uuid({ primaryKey: true }),
  ownerId: uuid({ notNull: true, references: { table: "users", column: "id", onDelete: "cascade", relationName: "owner", backRelationName: "stores" } }),
  name: varchar({ length: 255, notNull: true }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
}, (t) => [
  index().on(t.ownerId),
  index().on(t.name),
]);

export const categories = table("categories", {
  id: uuid({ primaryKey: true }),
  name: varchar({ length: 100, notNull: true }),
}, (t) => [
  index().on(t.name)
]);

export const products = table("products", {
  id: uuid({ primaryKey: true }),
  storeId: uuid({ notNull: true, references: { table: "stores", column: "id", onDelete: "cascade", relationName: "store", backRelationName: "products" } }),
  categoryId: uuid({ notNull: true, references: { table: "categories", column: "id", onDelete: "cascade", relationName: "category", backRelationName: "products" } }),
  name: varchar({ length: 255, notNull: true }),
  price: numeric(),
  stock: integer({ notNull: true, default: 0 }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
}, (t) => [
  index().on(t.storeId),
  index().on(t.name),
]);

export const reviews = table("reviews", {
  id: uuid({ primaryKey: true }),
  productId: uuid({ notNull: true, references: { table: "products", column: "id", onDelete: "cascade", relationName: "product", backRelationName: "reviews" } }),
  userId: uuid({ notNull: true, references: { table: "users", column: "id", onDelete: "cascade", relationName: "author", backRelationName: "reviews" } }),
  rating: integer({ notNull: true }),
  comment: text(),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
}, (t) => [
  index().on(t.productId),
  index().on(t.userId),
  index().on(t.rating)
]);

export const orders = table("orders", {
  id: uuid({ primaryKey: true }),
  userId: uuid({ notNull: true, references: { table: "users", column: "id", onDelete: "cascade", relationName: "user", backRelationName: "orders" } }),
  total: numeric({ notNull: true }),
  status: varchar({ length: 50, notNull: true, default: "pending" }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
}, (t) => [
  index().on(t.userId),
  index().on(t.status)
]);

export const orderItems = table("order_items", {
  id: uuid({ primaryKey: true }),
  orderId: uuid({ notNull: true, references: { table: "orders", column: "id", onDelete: "cascade", relationName: "order", backRelationName: "items" } }),
  productId: uuid({ notNull: true, references: { table: "products", column: "id", onDelete: "restrict", relationName: "product", backRelationName: "orderItems" } }),
  quantity: integer({ notNull: true }),
  price: numeric({ notNull: true }),
}, (t) => [
  index().on(t.orderId)
]);

// NEW Many-to-Many Tables:
export const tags = table("tags", {
  id: uuid({ primaryKey: true }),
  name: varchar({ length: 50, notNull: true }),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
}, (t) => [
  unique().on(t.name)
]);

export const productTags = table("product_tags", {
  id: uuid({ primaryKey: true }),
  productId: uuid({ notNull: true, references: { table: "products", column: "id", onDelete: "cascade" } }),
  tagId: uuid({ notNull: true, references: { table: "tags", column: "id", onDelete: "cascade" } }),
});

export const logs = table("logs", {
  id: uuid({ primaryKey: true }),
  level: varchar({ length: 50, notNull: true }),
  message: text({ notNull: true }),
  meta: jsonb(),
  tags: textArray(),
  createdAt: timestamptz({ notNull: true, defaultRaw: "NOW()" }),
});
