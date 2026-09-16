CREATE TABLE IF NOT EXISTS dog_users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dog_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES dog_users(id), expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS dog_sessions_expiry ON dog_sessions(expires);
CREATE TABLE IF NOT EXISTS dog_days (user_id TEXT NOT NULL REFERENCES dog_users(id), day TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id, day));
CREATE TABLE IF NOT EXISTS dog_auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS dog_profiles (user_id TEXT PRIMARY KEY REFERENCES dog_users(id), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dog_google_connections (user_id TEXT PRIMARY KEY REFERENCES dog_users(id), token_blob TEXT NOT NULL, reconnect INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS dog_google_oauth (state_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES dog_users(id), session_hash TEXT NOT NULL, verifier TEXT NOT NULL, origin TEXT NOT NULL, expires INTEGER NOT NULL, claimed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS dog_care_days (user_id TEXT NOT NULL REFERENCES dog_users(id), day TEXT NOT NULL, unlocked INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0, last_action TEXT, last_task TEXT, last_at INTEGER, PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS dog_care_receipts (user_id TEXT NOT NULL REFERENCES dog_users(id), day TEXT NOT NULL, task_id TEXT NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(user_id,day,task_id));
CREATE TABLE IF NOT EXISTS dog_settings (user_id TEXT PRIMARY KEY REFERENCES dog_users(id), rollover INTEGER NOT NULL DEFAULT 1);
-- Transient transfer rows exist only inside the atomic rollover batch.
CREATE TABLE IF NOT EXISTS dog_rollover_moves (user_id TEXT NOT NULL, source_day TEXT NOT NULL, task_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(user_id,source_day,task_id));
CREATE TABLE IF NOT EXISTS dog_group_colors (user_id TEXT NOT NULL REFERENCES dog_users(id), name TEXT NOT NULL, color TEXT NOT NULL, PRIMARY KEY(user_id,name));
