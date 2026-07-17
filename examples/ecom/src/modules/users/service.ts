import { eq } from "@bungres/orm";
import type { UnwrapSchema } from "elysia";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import type { UserModel } from "./model";

export abstract class UserService {
  static async create(data: UnwrapSchema<typeof UserModel.createBody>) {
    return await db.insert(users)
      .values({
        name: data.name,
        email: data.email,
      })
      .returning()
      .single();
  }

  static async findMany() {
    return await db.users.findMany({ limit: 100 });
  }

  static async findById(id: string) {
    return await db.select().from(users).where(eq(users.id, id)).single();
  }

  static async update(id: string, data: UnwrapSchema<typeof UserModel.updateBody>) {
    return await db.update(users)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
      })
      .where(eq(users.id, id))
      .returning()
      .single();
  }

  static async delete(id: string) {
    await db.execute(db.delete(users).where(eq(users.id, id)));
    return { success: true, id };
  }

  static async getOrders(userId: string) {
    return await db.users.findFirst({
      where: eq(users.id, userId),
      with: {
        orders: true
      }
    });
  }

  static async getDashboard(userId: string) {
    return await db.users.findFirst({
      where: eq(users.id, userId),
      with: {
        orders: {
          with: {
            items: {
              with: {
                product: {
                  with: {
                    store: true,
                    tags: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
