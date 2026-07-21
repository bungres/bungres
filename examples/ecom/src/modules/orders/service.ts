import { eq, gte, inArray, sql } from "@bungres/orm";
import type { UnwrapSchema } from "elysia";
import { db } from "../../db/client";
import { orderLines, orders, products, users } from "../../db/schema";
import type { OrderModel } from "./model";

export abstract class OrderService {
  static async create(data: UnwrapSchema<typeof OrderModel.createBody>) {
    return await db.transaction(async (tx) => {
      // 1. Validate user exists
      const user = await tx.select(users).where(eq(users.id, data.customerId)).single();
      if (!user) throw new Error(JSON.stringify({ code: "VALIDATION", message: "Customer not found" }));

      // 2. Fetch products to calculate total and verify stock
      let subtotal = 0;
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
        subtotal += Number(prod.price) * item.quantity;
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
          customerId: data.customerId,
          subtotal: subtotal,
          total: subtotal, // simplified for example
          ...(data.status !== undefined && { status: data.status as any }),
        })
        .returning()
        .single();

      if (!order) throw new Error("Failed to create order");

      // 5. Batch Insert Order Lines
      const orderLinesData = data.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: productMap.get(item.productId)!.price,
        totalPrice: Number(productMap.get(item.productId)!.price) * item.quantity,
      }));

      const items = await tx.insert(orderLines).values(orderLinesData).returning();

      return { ...order, items };
    });
  }

  static async findMany() {
    return await db.select({
      id: orderLines.id,
      quantity: orderLines.quantity,
      unitPrice: orderLines.unitPrice,
      order: {
        id: orders.id,
        total: orders.total,
        status: orders.status,
        createdAt: orders.createdAt,
        customer: {
          id: users.id,
          name: users.name,
          email: users.email
        }
      },
      product: {
        id: products.id,
        name: products.name,
        price: products.price
      }
    })
      .from(orderLines)
      .innerJoin(orders, eq(orderLines.orderId, orders.id))
      .innerJoin(products, eq(orderLines.productId, products.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .where(gte(orderLines.quantity, 1))
      .orderBy(orderLines.quantity, "desc")
      .orderBy(orders.createdAt, "desc")
      .limit(10);
  }

  static async findManyNested() {
    return await db.select()
      .from(orderLines)
      .innerJoin(orders, eq(orderLines.orderId, orders.id))
      .innerJoin(products, eq(orderLines.productId, products.id))
      .innerJoin(users, eq(orders.customerId, users.id))
      .limit(5);
  }

  static async findById(id: string) {
    return await db.orders.findFirst({
      columns: { id: true, total: true, status: true, createdAt: true },
      where: eq(orders.id, id),
      with: {
        lines: {
          columns: { id: true, quantity: true, unitPrice: true },
          with: {
            product: {
              columns: { id: true, name: true }
            }
          }
        },
        customer: {
          columns: { id: true, name: true }
        }
      }
    });
  }

  static async update(id: string, data: UnwrapSchema<typeof OrderModel.updateBody>) {
    return await db.update(orders)
      .set({
        ...(data.total !== undefined && { total: data.total }),
        ...(data.status !== undefined && { status: data.status as any }),
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
