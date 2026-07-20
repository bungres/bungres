import type { ResolvedConfig } from "../config.js";
import { diffSchemas, type SchemaSnapshot } from "../differ.js";
import { loadSchemas } from "../schema-loader.js";
import * as p from "@clack/prompts";
import pc from "picocolors";

// ---------------------------------------------------------------------------
// push — apply schema directly to the database (no migration files)
// Uses a hidden table __bungres_push to track the previous schema state
// and perform an exact diff.
// ---------------------------------------------------------------------------

export async function runPush(
  config: ResolvedConfig,
  opts: { force?: boolean } = {}
): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" @bungres/kit push ")));
  const s = p.spinner();
  s.start("Loading schemas...");

  const schemas = await loadSchemas(config.schema);

  if (schemas.length === 0) {
    s.stop("No schemas found.");
    p.log.warn(pc.yellow("No table definitions found. Check your schema glob pattern."));
    p.outro("Failed.");
    return;
  }
  s.stop(`Loaded ${schemas.length} schemas.`);

  const sql = new Bun.SQL(config.dbUrl);
  const ms = p.spinner();
  ms.start("Computing diff from database...");

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
    let prevSnapshot: SchemaSnapshot = { tables: {}, enums: {}, views: {} };
    if (rows.length > 0) {
      const parsed = typeof rows[0].snapshot === "string"
        ? JSON.parse(rows[0].snapshot)
        : rows[0].snapshot;
      if (parsed.tables || parsed.enums || parsed.views) {
        prevSnapshot = {
          tables: parsed.tables || {},
          enums: parsed.enums || {},
          views: parsed.views || {}
        };
      } else {
        prevSnapshot = { tables: parsed, enums: {}, views: {} };
      }
    }

    // Current snapshot from TypeScript
    const currentSnapshot: SchemaSnapshot = { tables: {}, enums: {}, views: {} };
    for (const s of schemas) {
      if (s.type === "table") {
        currentSnapshot.tables[s.config.name] = s.config;
      } else if (s.type === "enum") {
        currentSnapshot.enums[s.enumName] = { enumName: s.enumName, enumValues: s.enumValues };
      } else if (s.type === "view") {
        currentSnapshot.views[s.config.name] = s.config;
      }
    }

    // Diff
    const diff = diffSchemas(prevSnapshot, currentSnapshot);

    if (diff.statements.length === 0) {
      ms.stop("Up to date.");
      p.log.success(pc.green("No schema changes detected. Database is up to date."));
      p.outro("Done.");
      return;
    }
    
    ms.stop(`Computed ${diff.statements.length} statements.`);

    p.log.message(pc.bold("Changes to apply:"));
    for (const change of diff.summary) {
      if (change.startsWith("CREATE") || change.startsWith("ALTER TABLE") && change.includes("ADD")) {
        p.log.success(pc.green(`  + ${change}`));
      } else if (change.startsWith("DROP") || change.startsWith("ALTER TABLE") && change.includes("DROP")) {
        p.log.error(pc.red(`  - ${change}`));
      } else {
        p.log.info(pc.blue(`  ~ ${change}`));
      }
    }

    if (diff.warnings && diff.warnings.length > 0) {
      p.log.warn(pc.bgRed(pc.white(" ⚠️ DATA LOSS DETECTED ")));
      for (const w of diff.warnings) p.log.warn(pc.red(`  ! ${w}`));
      p.log.warn(pc.yellow("These changes will be immediately executed against the database!"));
    }

    if (!opts.force) {
      const confirm = await p.confirm({
        message: "Are you sure you want to push these changes?",
        initialValue: true
      });
      if (p.isCancel(confirm) || !confirm) {
        p.outro(pc.gray("Push aborted."));
        return;
      }
    }

    const exSpinner = p.spinner();
    exSpinner.start("Pushing changes...");

    // Execute diff statements
    for (const stmt of diff.statements) {
      if (config.verbose) {
        p.log.info(pc.gray(`-- ${stmt}`));
      }
      await sql.unsafe(stmt);
    }

    // Save new snapshot
    await sql.unsafe(
      `INSERT INTO ${qualifiedPush} (snapshot) VALUES ($1);`,
      [JSON.stringify(currentSnapshot)]
    );

    exSpinner.stop(pc.green("Changes applied successfully."));
    p.outro(pc.cyan("✨ Push complete."));
  } catch (err: any) {
    p.log.error(pc.red(`Push failed: ${err.message}`));
    p.outro("Failed.");
  } finally {
    await sql.end();
  }
}
