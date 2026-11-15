import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;

export function getDbPath(): string {
  if (process.env.TEST_DB_PATH) return process.env.TEST_DB_PATH;
  if (process.env.SQLITE_DB_PATH) return process.env.SQLITE_DB_PATH;
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'teamforge.db');
}

export function initDatabase(customPath?: string): DatabaseSync {
  const targetPath = customPath ?? getDbPath();
  if (dbInstance && currentDbPath === targetPath) {
    return dbInstance;
  }
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore close errors during re-init
    }
  }

  const db = new DatabaseSync(targetPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 10000;
    PRAGMA synchronous = NORMAL;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      skills_json TEXT NOT NULL DEFAULT '[]',
      experience_level TEXT NOT NULL DEFAULT 'INTERMEDIATE',
      preferred_roles_json TEXT NOT NULL DEFAULT '[]',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      weekly_availability INTEGER NOT NULL DEFAULT 15,
      github_url TEXT,
      portfolio_url TEXT,
      is_demo_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hackathons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      theme TEXT NOT NULL,
      registration_deadline TEXT NOT NULL,
      min_team_size INTEGER NOT NULL CHECK (min_team_size >= 1),
      max_team_size INTEGER NOT NULL CHECK (max_team_size >= min_team_size),
      required_skills_json TEXT NOT NULL DEFAULT '[]',
      banner_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      required_skills_json TEXT NOT NULL DEFAULT '[]',
      min_size INTEGER NOT NULL CHECK (min_size >= 1),
      max_size INTEGER NOT NULL CHECK (max_size >= min_size),
      leader_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'ARCHIVED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (hackathon_id, name)
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('LEADER', 'MEMBER')),
      joined_at TEXT NOT NULL,
      UNIQUE (team_id, user_id),
      UNIQUE (hackathon_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
      inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitee_email TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
      max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
      uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS join_requests (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      hackathon_id TEXT,
      team_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, endpoint, idempotency_key)
    );

    CREATE INDEX IF NOT EXISTS idx_teams_hackathon ON teams(hackathon_id, status);
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_invitations_team ON invitations(team_id, status);
    CREATE INDEX IF NOT EXISTS idx_join_requests_team ON join_requests(team_id, status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_team ON audit_logs(team_id, created_at DESC);
  `);

  dbInstance = db;
  currentDbPath = targetPath;
  return db;
}

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

/**
 * Executes a callback inside an exclusive write transaction (BEGIN IMMEDIATE).
 * In SQLite WAL mode, BEGIN IMMEDIATE acquires the database-level RESERVED/EXCLUSIVE
 * write lock before any reads inside the transaction, providing serializable
 * pessimistic locking equivalent to PostgreSQL's SELECT ... FOR UPDATE.
 */
export function withTransaction<T>(fn: (db: DatabaseSync) => T): T {
  const db = getDb();
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn(db);
        db.exec('COMMIT');
        return result;
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // ignore rollback error
        }
        throw err;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((msg.includes('SQLITE_BUSY') || msg.includes('database is locked')) && attempt < maxAttempts - 1) {
        // Synchronous tiny spin-wait only on rare lock contention beyond busy_timeout
        const until = Date.now() + 5 + Math.floor(Math.random() * 15);
        while (Date.now() < until) {
          // wait
        }
        continue;
      }
      throw err;
    }
  }
  throw new Error('Transaction failed after retries');
}
