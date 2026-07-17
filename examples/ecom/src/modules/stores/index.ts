import { Elysia } from "elysia";
import { StoreModel } from "./model";
import { StoreService } from "./service";

export const storesModule = new Elysia({ prefix: "/stores" })
  .post("/", ({ body }) => StoreService.create(body), {
    body: StoreModel.createBody,
  })
  .get("/", () => StoreService.findMany())
  .get("/:id", ({ params }) => StoreService.findById(params.id), {
    params: StoreModel.params,
  })
  .put("/:id", ({ params, body }) => StoreService.update(params.id, body), {
    params: StoreModel.params,
    body: StoreModel.updateBody,
  })
  .delete("/:id", ({ params }) => StoreService.delete(params.id), {
    params: StoreModel.params,
  })
  .get("/:id/products", ({ params }) => StoreService.getProducts(params.id), {
    params: StoreModel.params,
  })
  .get("/:id/full", ({ params }) => StoreService.getFull(params.id), {
    params: StoreModel.params,
  });
