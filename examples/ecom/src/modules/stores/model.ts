import { t } from "elysia";

export const StoreModel = {
  createBody: t.Object({
    ownerId: t.String(),
    name: t.String(),
  }),
  updateBody: t.Object({
    name: t.Optional(t.String()),
  }),
  params: t.Object({
    id: t.String(),
  }),
};
