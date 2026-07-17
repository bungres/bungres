import { t } from "elysia";

export const UserModel = {
  createBody: t.Object({
    name: t.String(),
    email: t.String(),
  }),
  updateBody: t.Object({
    name: t.Optional(t.String()),
    email: t.Optional(t.String()),
  }),
  params: t.Object({
    id: t.String(),
  }),
};
