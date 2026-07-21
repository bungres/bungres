import { t } from "elysia";

export const AuditLogModel = {
  query: t.Object({
    limit: t.Optional(t.Numeric()),
    offset: t.Optional(t.Numeric()),
  }),
};
