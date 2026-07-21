import { Elysia } from "elysia";
import { OrderModel } from "./model";
import { OrderService } from "./service";

export const ordersModule = new Elysia({ prefix: "/orders" })
  .post("/", ({ body }) => OrderService.create(body), {
    body: OrderModel.createBody,
  })
  .get("/", () => OrderService.findMany())
  .get("/nested", () => OrderService.findManyNested())
  .get("/:id", ({ params }) => OrderService.findById(params.id), {
    params: OrderModel.params,
  })
  .put("/:id", ({ params, body }) => OrderService.update(params.id, body), {
    params: OrderModel.params,
    body: OrderModel.updateBody,
  })
  .delete("/:id", ({ params }) => OrderService.delete(params.id), {
    params: OrderModel.params,
  });
