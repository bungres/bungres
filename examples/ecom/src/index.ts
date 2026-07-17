import { desc, eq } from "@bungres/orm";
import { Elysia } from "elysia";
import { db } from "./db/client";
import { products } from "./db/schema";

const app = new Elysia()
  .get("/", () => "Bungres ORM Benchmark Server")

  .get("/random-user", async () => {
    return await db.users.findFirst({ limit: 1 });
  })

  .get("/random-store", async () => {
    return await db.stores.findFirst({ limit: 1 });
  })

  // Benchmark 1: Simple queries, no relations
  .get("/products", async () => {
    return await db.products.findMany({ limit: 100 });
  })

  // Benchmark 2: Shallow Relations (Product -> Store & Category)
  .get("/products-with-details", async () => {
    return await db.products.findMany({
      limit: 100,
      orderBy: desc(products.name),
      with: {
        store: {
          columns: { name: true }
        },
        category: {
          columns: { name: true }
        },
        tags: {
          columns: { name: true }
        }, // Now testing the Many-to-Many M2M feature!
      },
    });
  })

  // Benchmark 3: Deep Relations (User -> Orders -> OrderItems -> Product -> Store)
  .get("/users/:id/dashboard", async ({ params: { id } }: { params: { id: string } }) => {
    return await db.users.findFirst({
      where: eq("id", id),
      with: {
        orders: {
          with: {
            items: {
              with: {
                product: {
                  with: {
                    store: true,
                    tags: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  })

  // Benchmark 4: Heavy Aggregation/Nesting (Store -> Products -> Reviews & Category)
  .get("/stores/:id/full", async ({ params: { id } }: { params: { id: string } }) => {
    return await db.stores.findFirst({
      where: eq("id", id),
      with: {
        owner: true,
        products: {
          limit: 50,
          with: {
            category: true,
            tags: true,
            reviews: { limit: 10 },
          },
        },
      },
    });
  })

  .listen(3000);

console.log(
  `🚀 Elysia benchmark server is running at ${app.server?.hostname}:${app.server?.port}`
);
