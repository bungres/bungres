import { bungres } from "@bungres/orm";
import * as schema from "./schema";

const url = Bun.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL is not set");
}

export const db = bungres({ url, schema });
