import { Elysia } from "elysia";
import { ProductModel } from "./model";
import { ProductService } from "./service";

export const productsModule = new Elysia({ prefix: "/products" })
  .post("/", ({ body }) => ProductService.create(body), {
    body: ProductModel.createBody,
  })
  .get("/", ({ query }) => ProductService.findMany(query), {
    query: ProductModel.query,
  })
  .get("/:id", ({ params }) => ProductService.findById(params.id), {
    params: ProductModel.params,
  })
  .put("/:id", ({ params, body }) => ProductService.update(params.id, body), {
    params: ProductModel.params,
    body: ProductModel.updateBody,
  })
  .delete("/:id", ({ params }) => ProductService.delete(params.id), {
    params: ProductModel.params,
  });
