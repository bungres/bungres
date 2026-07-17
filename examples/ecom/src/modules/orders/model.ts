import { t } from "elysia";

export const OrderModel = {
  createBody: t.Object({
    userId: t.String(),
    items: t.Array(t.Object({
      productId: t.String(),
      quantity: t.Numeric()
    })),
    status: t.Optional(t.String()),
  }),
  updateBody: t.Object({
    total: t.Optional(t.Numeric()),
    status: t.Optional(t.String()),
  }),
  params: t.Object({
    id: t.String(),
  }),
};
