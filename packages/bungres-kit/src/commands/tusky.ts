import { bungres } from "@bungres/orm";
import * as p from "@clack/prompts";
import pc from "picocolors";

import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";

// ---------------------------------------------------------------------------
// tusky — boot up a basic REPL connected to the database
// ---------------------------------------------------------------------------

export async function runTusky(config: ResolvedConfig): Promise<void> {
  const schemas = (await loadSchemas(config.schema)).filter((s: any) => s.type === "table") as any[];

  const schemaObj: Record<string, any> = {};
  for (const s of schemas) {
    schemaObj[s.exportName] = s.table;
  }

  const db = bungres({ url: config.dbUrl, schema: schemaObj });

  p.intro(pc.bgCyan(pc.black(" 🐘 Bungres REPL (Tusky) ")));
  p.log.success(pc.green("Database connection established."));
  p.note(`Example: ${pc.cyan("db.select().from(users);")}\nExit:    ${pc.cyan("exit")}`, "Commands");

  // Inject variables into the global scope so eval() can see them
  (globalThis as any).db = db;
  for (const s of schemas) {
    (globalThis as any)[s.exportName] = s.table;
  }

  process.stdout.write("bungres> ");

  for await (const line of console) {
    const input = line.trim();
    if (["exit", ".exit", "quit", ".quit", "exit()", "quit()"].includes(input.toLowerCase())) {
      break;
    }
    if (!input) {
      process.stdout.write("bungres> ");
      continue;
    }

    try {
      let code = input;

      // DX Improvement: If the input starts with a SQL keyword, automatically wrap it in db.raw()
      const isRawSql = /^(select|insert|update|delete|create|drop|alter|truncate|with)\b/i.test(input);

      if (isRawSql) {
        console.log(`(Running as raw SQL: await db.raw(\`${input}\`))`);
        code = `(async () => { return await db.raw(\`${input}\`); })()`;
      } else if (input.includes("await ")) {
        // Top-level await needs an async IIFE.
        code = `(async () => { return await ${input}; })()`;
      }

      const start = performance.now();
      const result = await eval(code);
      const end = performance.now();
      const duration = (end - start).toFixed(2);

      if (Array.isArray(result) && result.length > 0 && typeof result[0] === "object") {
        console.table(result);
      } else {
        console.log(result);
      }
      
      console.log(`\n(Execution time: ${duration}ms)`);
    } catch (err: any) {
      console.error(err.message || err);
    }
    process.stdout.write("bungres> ");
  }

  process.exit(0);
}
