import { Elysia } from "elysia";
import { LogModel } from "./model";
import { LogService } from "./service";

export const logsModule = new Elysia({ prefix: "/logs" })
  .get("/", ({ query }) => LogService.findMany(query), {
    query: LogModel.query
  });
