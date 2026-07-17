import { desc, eq, inArray, sql } from "@bungres/orm";
import type { UnwrapSchema } from "elysia";
import { db } from "../../db/client";
import { orderItems, orders, products, users } from "../../db/schema";
import type { OrderModel } from "./model";

export abstract class OrderService {
  static async create(data: UnwrapSchema<typeof OrderModel.createBody>) {
    return await db.transaction(async (tx) => {
      // 1. Validate user exists
      const user = await tx.select(users).where(eq(users.id, data.userId)).single();
      if (!user) throw new Error(JSON.stringify({ code: "VALIDATION", message: "User not found" }));

      // 2. Fetch products to calculate total and verify stock
      let total = 0;
      const productIds = data.items.map((i) => i.productId);

      if (productIds.length === 0) {
        throw new Error(JSON.stringify({ code: "VALIDATION", message: "Order must contain at least one item" }));
      }

      const productsList = await tx.select(products).where(inArray(products.id, productIds));
      const productMap = new Map(productsList.map((p) => [p.id, p]));

      for (const item of data.items) {
        const prod = productMap.get(item.productId);
        if (!prod) {
          throw new Error(JSON.stringify({ code: "VALIDATION", message: `Product ${item.productId} not found` }));
        }
        if (prod.stock < item.quantity) {
          throw new Error(JSON.stringify({ code: "VALIDATION", message: `Insufficient stock for product ${prod.name}` }));
        }
        total += Number(prod.price) * item.quantity;
      }

      // 3. Deduct stock (atomic)
      for (const item of data.items) {
        await tx.update(products)
          .set({ stock: sql`stock - ${item.quantity}` })
          .where(eq(products.id, item.productId));
      }

      // 4. Create Order
      const order = await tx.insert(orders)
        .values({
          userId: data.userId,
          total: total,
          ...(data.status !== undefined && { status: data.status }),
        })
        .returning()
        .single();

      if (!order) throw new Error("Failed to create order");

      // 5. Batch Insert Order Items
      const orderItemsData = data.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        price: productMap.get(item.productId)!.price,
      }));

      const items = await tx.insert(orderItems).values(orderItemsData).returning();

      return { ...order, items };
    });
  }

  static async findMany() {
    return await db.orders.findMany({
      columns: { id: true, total: true, createdAt: true },
      limit: 10,
      orderBy: desc(orders.total),
      with: {
        user: {
          columns: { id: true, name: true, email: true }
        }
      }
    });
  }

  static async findById(id: string) {
    return await db.orders.findFirst({
      columns: { id: true, total: true, status: true, createdAt: true },
      where: eq(orders.id, id),
      with: {
        items: {
          columns: { id: true, quantity: true, price: true },
          with: {
            product: {
              columns: { id: true, name: true }
            }
          }
        },
        user: {
          columns: { id: true, name: true }
        }
      }
    });
  }

  static async update(id: string, data: UnwrapSchema<typeof OrderModel.updateBody>) {
    return await db.update(orders)
      .set({
        ...(data.total !== undefined && { total: data.total }),
        ...(data.status !== undefined && { status: data.status }),
      })
      .where(eq(orders.id, id))
      .returning()
      .single();
  }

  static async delete(id: string) {
    const deleted = await db.delete(orders)
      .where(eq(orders.id, id))
      .returning()
      .single();

    if (!deleted) {
      throw new Error(JSON.stringify({ code: "NOT_FOUND", message: "Order not found" }));
    }

    return { success: true, id };
  }
}
