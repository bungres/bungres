import { desc } from "@bungres/orm";
import { db } from "../../db/client";
import { logs } from "../../db/schema";
import type { UnwrapSchema } from "elysia";
import type { LogModel } from "./model";

export abstract class LogService {
  static async findMany(query: UnwrapSchema<typeof LogModel.query>) {
    return await db.logs.findMany({
      limit: query.limit || 50,
      offset: query.offset || 0,
      orderBy: desc(logs.createdAt)
    });
  }
}
