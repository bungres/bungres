// ---------------------------------------------------------------------------
// @bungres/kit — Migration Folder Loader Utility
// Discovers and parses timestamped migration directories containing:
//   - up.sql
//   - down.sql
//   - snapshot.json
// ---------------------------------------------------------------------------

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SchemaSnapshot } from "./differ.js";

export interface MigrationFolder {
  name: string; // e.g. "2026_07_21_070032_init" or "2026_07_21_070032"
  dirPath: string;
  upPath: string;
  downPath: string;
  snapshotPath: string;
  upContent: string;
  downContent: string;
  snapshot: SchemaSnapshot | null;
}

export async function loadMigrationFolders(migrationsDir: string): Promise<MigrationFolder[]> {
  const absDir = resolve(migrationsDir);
  if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
    return [];
  }

  const entries = readdirSync(absDir);
  const folders: MigrationFolder[] = [];

  for (const entry of entries) {
    const fullPath = join(absDir, entry);
    if (!statSync(fullPath).isDirectory()) continue;
    if (entry === "meta" || entry.startsWith(".")) continue;

    const upPath = join(fullPath, "up.sql");
    const downPath = join(fullPath, "down.sql");
    const snapshotPath = join(fullPath, "snapshot.json");

    if (!existsSync(upPath)) continue;

    const upContent = await Bun.file(upPath).text();
    const downContent = existsSync(downPath) ? await Bun.file(downPath).text() : "";

    let snapshot: SchemaSnapshot | null = null;
    if (existsSync(snapshotPath)) {
      try {
        snapshot = await Bun.file(snapshotPath).json();
      } catch {
        snapshot = null;
      }
    }

    folders.push({
      name: entry,
      dirPath: fullPath,
      upPath,
      downPath,
      snapshotPath,
      upContent,
      downContent,
      snapshot,
    });
  }

  // Sort chronologically by directory name
  folders.sort((a, b) => a.name.localeCompare(b.name));
  return folders;
}

export async function loadLatestSnapshotFromFolders(migrationsDir: string): Promise<SchemaSnapshot | null> {
  const folders = await loadMigrationFolders(migrationsDir);
  for (let i = folders.length - 1; i >= 0; i--) {
    if (folders[i]!.snapshot) {
      return folders[i]!.snapshot;
    }
  }
  return null;
}
