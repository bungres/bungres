import * as fs from "node:fs";
import type { ResolvedConfig } from "../config.js";
import { diffSchemas, type SchemaSnapshot } from "../differ.js";
import { loadSchemas } from "../schema-loader.js";

// ---------------------------------------------------------------------------
// push — apply schema directly to the database (no migration files)
// Uses a hidden table __bungres_push to track the previous schema state
// and perform an exact diff.
// ---------------------------------------------------------------------------

export async function runPush(
  config: ResolvedConfig,
  opts: { force?: boolean } = {}
): Promise<void> {
  console.log("@bungres/kit push: loading schemas...");

  const schemas = await loadSchemas(config.schema);

  if (schemas.length === 0) {
    console.warn("No table definitions found. Check your schema glob pattern.");
    return;
  }

  const sql = new Bun.SQL(config.dbUrl);

  try {
    // Ensure schema exists
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${config.migrationsSchema}";`);

    // Ensure our tracking table exists
    const qualifiedPush = `"${config.migrationsSchema}"."__bungres_push"`;
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS ${qualifiedPush} (
        id SERIAL PRIMARY KEY,
        snapshot JSONB NOT NULL
      );
    `);

    // Load previous snapshot from DB
    const rows = await sql.unsafe(`SELECT snapshot FROM ${qualifiedPush} ORDER BY id DESC LIMIT 1;`) as any[];
    let prevSnapshot: SchemaSnapshot = {};
    if (rows.length > 0) {
      prevSnapshot = typeof rows[0].snapshot === "string"
        ? JSON.parse(rows[0].snapshot)
        : rows[0].snapshot;
    }

    // Current snapshot from TypeScript
    const currentSnapshot: SchemaSnapshot = Object.fromEntries(
      schemas.map((s) => [s.config.name, s.config])
    );

    // Diff
    const diff = diffSchemas(prevSnapshot, currentSnapshot);

    if (diff.statements.length === 0) {
      console.log("\nNo schema changes detected. Database is up to date.");
      return;
    }

    console.log(`\nChanges to apply:`);
    for (const s of diff.summary) console.log(`  + ${s}`);

    if (diff.warnings && diff.warnings.length > 0) {
      console.warn(`\n  ⚠️  WARNING: Data Loss Detected!`);
      for (const w of diff.warnings) console.warn(`    ! ${w}`);
      console.warn(`\n  These changes will be immediately executed against the database!`);
    }

    if (!opts.force) {
      process.stdout.write("\nAre you sure you want to push these changes? Type YES to continue: ");
      const answer = await readLine();
      if (answer.trim().toLowerCase() !== "yes") {
        console.log("Aborted.");
        return;
      }
    }

    console.log(`\nPushing changes...`);

    // Execute diff statements
    for (const stmt of diff.statements) {
      if (config.verbose) {
        console.log(`-- ${stmt}`);
      }
      await sql.unsafe(stmt);
    }

    // Save new snapshot
    await sql.unsafe(
      `INSERT INTO ${qualifiedPush} (snapshot) VALUES ($1);`,
      [JSON.stringify(currentSnapshot)]
    );

    console.log("\nPush complete.");
  } finally {
    await sql.end();
  }
}

async function readLine(): Promise<string> {
  const buf = Buffer.alloc(256);
  const n = fs.readSync(0, buf, 0, 256, null);
  return buf.subarray(0, n).toString().trim();
}
