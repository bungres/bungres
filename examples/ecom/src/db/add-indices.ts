import { db } from "./client.ts";

async function main() {
  console.log("Adding indices...");
  
  await db.raw("CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);");
  await db.raw("CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);");
  await db.raw("CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);");
  await db.raw("CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);");
  
  console.log("Indices added!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
