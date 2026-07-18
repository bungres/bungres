import { defineConfig } from "@bungres/kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./bungres",
  dbCredentials: {
    url: Bun.env.DATABASE_URL!,
  },

  // Optional: customize the migrations tracking table
  // migrations: {
  //   table: "my_migrations",       // default: "__bungres_migrations"
  //   schema: "bungres",            // default: "bungres" (auto-created)
  // },

  // Optional: split SQL on -->statement-breakpoint markers (default: true)
  // breakpoints: true,

  // Optional: prompt before destructive commands like push/drop (default: false)
  // strict: false,

  // Optional: log every SQL statement that runs (default: false)
  // verbose: false,
});
