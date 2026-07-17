import { eq } from "@bungres/orm";
import { db } from "../../db/client";
import { stores } from "../../db/schema";
import type { UnwrapSchema } from "elysia";
import type { StoreModel } from "./model";

export abstract class StoreService {
  static async create(data: UnwrapSchema<typeof StoreModel.createBody>) {
    return await db.insert(stores)
      .values({
        ownerId: data.ownerId,
        name: data.name,
      })
      .returning()
      .single();
  }

  static async findMany() {
    return await db.stores.findMany({ limit: 100 });
  }

  static async findById(id: string) {
    return await db.select().from(stores).where(eq(stores.id, id)).single();
  }

  static async update(id: string, data: UnwrapSchema<typeof StoreModel.updateBody>) {
    return await db.update(stores)
      .set({
        ...(data.name !== undefined && { name: data.name }),
      })
      .where(eq(stores.id, id))
      .returning()
      .single();
  }

  static async delete(id: string) {
    await db.execute(db.delete(stores).where(eq(stores.id, id)));
    return { success: true, id };
  }

  static async getProducts(storeId: string) {
    return await db.stores.findFirst({
      where: eq(stores.id, storeId),
      with: {
        products: true
      }
    });
  }

  static async getFull(storeId: string) {
    return await db.stores.findFirst({
      where: eq(stores.id, storeId),
      with: {
        owner: true,
        products: {
          limit: 50,
          with: {
            category: true,
            tags: true,
            reviews: { limit: 10 },
          },
        },
      },
    });
  }
}
