import { bungres } from "@bungres/orm";
import * as schema from "./schema";

// Ensure DATABASE_URL is set or default to local docker instance for benchmarking
const url = Bun.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";

export const db = bungres({ url, schema });
