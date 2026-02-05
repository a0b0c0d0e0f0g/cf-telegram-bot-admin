export function nowMs() {
  return Date.now();
}

const schemaStatements = [
  "PRAGMA foreign_keys = ON",
  "CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner', created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS config_profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, parent_profile_id TEXT, ui_json TEXT NOT NULL, bot_logic_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(parent_profile_id) REFERENCES config_profiles(id))",
  "CREATE TABLE IF NOT EXISTS bots (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT, token_cipher TEXT NOT NULL, webhook_path_secret TEXT NOT NULL, config_profile_id TEXT NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(config_profile_id) REFERENCES config_profiles(id))",
  "CREATE TABLE IF NOT EXISTS external_connectors (id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, name TEXT NOT NULL, endpoint TEXT NOT NULL, method TEXT NOT NULL, headers_json TEXT NOT NULL, auth_type TEXT NOT NULL, auth_secret_name TEXT, timeout_ms INTEGER NOT NULL DEFAULT 8000, retry_json TEXT NOT NULL, response_map_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(profile_id) REFERENCES config_profiles(id))",
  "CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, detail_json TEXT NOT NULL, created_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_bots_profile ON bots(config_profile_id)",
  "CREATE INDEX IF NOT EXISTS idx_connectors_profile ON external_connectors(profile_id)"
];

let initPromise: Promise<void> | null = null;

export function ensureDatabase(db: D1Database) {
  if (!initPromise) {
    initPromise = (async () => {
      for (const statement of schemaStatements) {
        await db.prepare(statement).run();
      }
    })();
  }
  return initPromise;
}

export async function first<T = any>(stmt: D1PreparedStatement) {
  return (await stmt.first<T>()) ?? null;
}

export async function all<T = any>(stmt: D1PreparedStatement) {
  const r = await stmt.all<T>();
  return r.results ?? [];
}
