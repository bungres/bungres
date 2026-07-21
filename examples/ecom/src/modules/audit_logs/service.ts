import { desc } from "@bungres/orm";
import { db } from "../../db/client";
import { auditLogs } from "../../db/schema";
import type { UnwrapSchema } from "elysia";
import type { AuditLogModel } from "./model";

export abstract class AuditLogService {
  static async findMany(query: UnwrapSchema<typeof AuditLogModel.query>) {
    return await db.auditLogs.findMany({
      limit: query.limit || 50,
      offset: query.offset || 0,
      orderBy: desc(auditLogs.createdAt)
    });
  }
}
