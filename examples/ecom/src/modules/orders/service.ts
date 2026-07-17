import { eq } from "@bungres/orm";
import type { UnwrapSchema } from "elysia";
import { db } from "../../db/client";
import { orders } from "../../db/schema";
import type { OrderModel } from "./model";

export abstract class OrderService {
  static async create(data: UnwrapSchema<typeof OrderModel.createBody>) {
    return await db.insert(orders)
      .values({
        userId: data.userId,
        total: data.total,
        ...(data.status !== undefined && { status: data.status }),
      })
      .returning()
      .single();
  }

  static async findMany() {
    return await db.orders.findMany({ limit: 100 });
  }

  static async findById(id: string) {
    return await db.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: {
          with: {
            product: {
              columns: { name: true }
            }
          }
        },
        user: true
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
    await db.execute(db.delete(orders).where(eq(orders.id, id)));
    return { success: true, id };
  }
}
