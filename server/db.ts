/**
 * SQLite storage (better-sqlite3, synchronous — fine for this small app).
 * The database file lives in DATA_DIR (created if missing).
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export type Provider = 'anthropic' | 'openai';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
}

export interface AppDb {
  raw: Database.Database;
  getUserByUsername(username: string): UserRow | undefined;
  getUserById(id: number): UserRow | undefined;
  createUser(username: string, passwordHash: string): UserRow;
  upsertApiKey(userId: number, provider: Provider, encrypted: string): void;
  deleteApiKey(userId: number, provider: Provider): void;
  getApiKey(userId: number, provider: Provider): string | undefined;
  getKeyProviders(userId: number): Provider[];
  seedAdmin(username: string, password: string): void;
  close(): void;
}

const BCRYPT_ROUNDS = 10;

export function createDb(dataDir: string): AppDb {
  fs.mkdirSync(dataDir, { recursive: true });
  const raw = new Database(path.join(dataDir, 'app.db'));
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  raw.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
      encrypted_key TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, provider)
    );
  `);

  const selectByUsername = raw.prepare('SELECT * FROM users WHERE username = ?');
  const selectById = raw.prepare('SELECT * FROM users WHERE id = ?');
  const insertUser = raw.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  );
  const upsertKey = raw.prepare(`
    INSERT INTO api_keys (user_id, provider, encrypted_key, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT (user_id, provider)
    DO UPDATE SET encrypted_key = excluded.encrypted_key, updated_at = datetime('now')
  `);
  const deleteKey = raw.prepare(
    'DELETE FROM api_keys WHERE user_id = ? AND provider = ?'
  );
  const selectKey = raw.prepare(
    'SELECT encrypted_key FROM api_keys WHERE user_id = ? AND provider = ?'
  );
  const selectProviders = raw.prepare('SELECT provider FROM api_keys WHERE user_id = ?');

  return {
    raw,
    getUserByUsername: (username) =>
      selectByUsername.get(username.toLowerCase()) as UserRow | undefined,
    getUserById: (id) => selectById.get(id) as UserRow | undefined,
    createUser: (username, passwordHash) => {
      const info = insertUser.run(username.toLowerCase(), passwordHash);
      return selectById.get(info.lastInsertRowid) as UserRow;
    },
    upsertApiKey: (userId, provider, encrypted) => {
      upsertKey.run(userId, provider, encrypted);
    },
    deleteApiKey: (userId, provider) => {
      deleteKey.run(userId, provider);
    },
    getApiKey: (userId, provider) =>
      (selectKey.get(userId, provider) as { encrypted_key: string } | undefined)
        ?.encrypted_key,
    getKeyProviders: (userId) =>
      (selectProviders.all(userId) as { provider: Provider }[]).map((r) => r.provider),
    seedAdmin(username, password) {
      const normalized = username.toLowerCase();
      const existing = selectByUsername.get(normalized) as UserRow | undefined;
      if (!existing) {
        raw
          .prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)')
          .run(normalized, bcrypt.hashSync(password, BCRYPT_ROUNDS));
        console.log(`[2048-simulator] Seeded admin user "${normalized}"`);
        return;
      }
      const needsRehash = !bcrypt.compareSync(password, existing.password_hash);
      if (needsRehash || !existing.is_admin) {
        raw
          .prepare('UPDATE users SET password_hash = ?, is_admin = 1 WHERE id = ?')
          .run(
            needsRehash ? bcrypt.hashSync(password, BCRYPT_ROUNDS) : existing.password_hash,
            existing.id
          );
        console.log(`[2048-simulator] Updated admin user "${normalized}"`);
      }
    },
    close: () => raw.close(),
  };
}
