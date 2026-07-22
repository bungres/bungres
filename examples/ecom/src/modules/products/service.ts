import { desc, eq, ilike } from "@bungres/orm";
import type { UnwrapSchema } from "elysia";
import { db } from "../../db/client";
import { products } from "../../db/schema";
import type { ProductModel } from "./model";

export abstract class ProductService {
  static async create(data: UnwrapSchema<typeof ProductModel.createBody>) {
    return await db.insert(products)
      .values({
        storeId: data.storeId,
        categoryId: data.categoryId,
        name: data.name,
        price: data.price,
        stock: data.stock,
      })
      .returning()
      .single();
  }

  static async findMany(query: UnwrapSchema<typeof ProductModel.query>) {
    return await db.products.findMany({
      ...(query.q ? { where: ilike(products.name, `%${query.q}%`) } : {}),
      limit: query.limit ?? 100,
      offset: query.offset ?? 0,
      orderBy: desc(products.name),
      with: {
        store: { columns: { name: true } },
        category: { columns: { name: true } },
        tags: { columns: { name: true } },
      },
    });
  }

  static async findById(id: string) {
    return await db.select().from(products).where(eq(products.id, id)).single();
  }

  static async update(id: string, data: UnwrapSchema<typeof ProductModel.updateBody>) {
    return await db.update(products)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.stock !== undefined && { stock: data.stock }),
      })
      .where(eq(products.id, id))
      .returning()
      .single();
  }

  static async delete(id: string) {
    await db.delete(products).where(eq(products.id, id));
    return { success: true, id };
  }
}
