import { Elysia } from "elysia";
import { AuditLogModel } from "./model";
import { AuditLogService } from "./service";

export const auditLogsModule = new Elysia({ prefix: "/audit-logs" })
  .get("/", ({ query }) => AuditLogService.findMany(query), {
    query: AuditLogModel.query
  });
