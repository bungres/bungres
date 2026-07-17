import { t } from "elysia";

export const LogModel = {
  query: t.Object({
    limit: t.Optional(t.Numeric()),
    offset: t.Optional(t.Numeric()),
  }),
};
