import { t } from "elysia";

export const ProductModel = {
  createBody: t.Object({
    storeId: t.String(),
    categoryId: t.String(),
    name: t.String(),
    price: t.Numeric(),
    stock: t.Numeric(),
  }),
  updateBody: t.Object({
    name: t.Optional(t.String()),
    price: t.Optional(t.Numeric()),
    stock: t.Optional(t.Numeric()),
  }),
  query: t.Object({
    q: t.Optional(t.String()),
    limit: t.Optional(t.Numeric()),
    offset: t.Optional(t.Numeric()),
  }),
  params: t.Object({
    id: t.String(),
  }),
};
