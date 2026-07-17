import { defineConfig } from "@bungres/kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./bungres",
  dbCredentials: {
    url: Bun.env.DATABASE_URL!,
  },
});
