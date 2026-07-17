import { Elysia } from "elysia";
import { UserModel } from "./model";
import { UserService } from "./service";

export const usersModule = new Elysia({ prefix: "/users" })
  .post("/", ({ body }) => UserService.create(body), {
    body: UserModel.createBody,
  })
  .get("/", () => UserService.findMany())
  .get("/:id", ({ params }) => UserService.findById(params.id), {
    params: UserModel.params,
  })
  .put("/:id", ({ params, body }) => UserService.update(params.id, body), {
    params: UserModel.params,
    body: UserModel.updateBody,
  })
  .delete("/:id", ({ params }) => UserService.delete(params.id), {
    params: UserModel.params,
  })
  .get("/:id/orders", ({ params }) => UserService.getOrders(params.id), {
    params: UserModel.params,
  })
  .get("/:id/dashboard", ({ params }) => UserService.getDashboard(params.id), {
    params: UserModel.params,
  });
