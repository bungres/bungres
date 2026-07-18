import * as readline from "node:readline";
import { bungres } from "@bungres/orm";
import type { ResolvedConfig } from "../config.js";
import { loadSchemas } from "../schema-loader.js";

// ---------------------------------------------------------------------------
// tusky — boot up a basic REPL connected to the database
// ---------------------------------------------------------------------------

export async function runTusky(config: ResolvedConfig): Promise<void> {
  const schemas = await loadSchemas(config.schema);

  const schemaObj: Record<string, any> = {};
  for (const s of schemas) {
    schemaObj[s.exportName] = s.table;
  }

  const db = bungres({ url: config.dbUrl, schema: schemaObj });

  console.log("=========================================");
  console.log("🐘 Welcome to Bungres REPL (Tusky)");
  console.log("=========================================");
  console.log("\nDatabase connection established.");
  console.log("\nPre-loaded Context:");
  console.log("  - db      (Bungres Database Client)");
  for (const s of schemas) {
    console.log(`  - ${s.exportName} (Table)`);
  }
  console.log("\nExample query: await db.select().from(users)");
  console.log("Type .exit to quit.\n");

  // Create a custom REPL using readline since Bun doesn't support node:repl.start()
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "bungres> "
  });

  // Inject variables into the global scope so eval() can see them
  (globalThis as any).db = db;
  for (const s of schemas) {
    (globalThis as any)[s.exportName] = s.table;
  }

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (input === ".exit") {
      rl.close();
      return;
    }
    if (!input) {
      rl.prompt();
      return;
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
        code = `(async () => { return ${input}; })()`;
      }
      
      const result = await eval(code);
      console.log(result);
    } catch (err: any) {
      console.error(err.message || err);
    }
    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
