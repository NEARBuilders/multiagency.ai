import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Migration } from "virtual:drizzle-migrations.sql";

// 0000_initial.sql has hand-edited IF NOT EXISTS / DROP IF EXISTS guards — preserve them when regenerating via drizzle-kit.
export async function loadMigrations(): Promise<Migration[]> {
  try {
    const mod = await import("virtual:drizzle-migrations.sql");
    return mod.default;
  } catch {
    return loadMigrationsFromDisk();
  }
}

function loadMigrationsFromDisk(): Migration[] {
  const migrationsDir = resolve(import.meta.dirname, "migrations");
  const metaDir = join(migrationsDir, "meta");

  const journal = JSON.parse(readFileSync(join(metaDir, "_journal.json"), "utf8"));

  return journal.entries.map((entry: { idx: number; when: number; tag: string }) => {
    const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
    const raw = readFileSync(sqlPath, "utf8");
    const sql = raw.split("--> statement-breakpoint").map((s: string) => s.trim());
    // Match the bundled migrator (@proj-airi/unplugin-drizzle-orm-migrations)
    // which writes full 64-char SHA-256 hashes into drizzle.__drizzle_migrations.
    const hash = createHash("sha256").update(raw).digest("hex");

    return {
      idx: entry.idx,
      when: entry.when,
      tag: entry.tag,
      hash,
      sql,
    };
  });
}
