import { Elysia } from "elysia";
import { productsModule } from "./modules/products";
import { usersModule } from "./modules/users";
import { storesModule } from "./modules/stores";
import { ordersModule } from "./modules/orders";
import { errorPlugin } from "./plugins/error";

const app = new Elysia()
  .use(errorPlugin)
  .get("/", () => "Bungres ORM API Example (Modular MVC)")
  .use(productsModule)
  .use(usersModule)
  .use(storesModule)
  .use(ordersModule)
  .listen(3000);

console.log(
  `🚀 Elysia API server is running at ${app.server?.hostname}:${app.server?.port}`
);
