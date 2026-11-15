import { Router } from 'express';
import { getDb } from '../db.ts';
import { AppError } from '../errors.ts';
import {
  clearAuthCookie,
  generateUserId,
  hashPassword,
  mapUserRow,
  requireAuth,
  setAuthCookie,
  signAccessToken,
  verifyPassword,
  type AuthenticatedRequest,
  type UserRow,
} from '../auth.ts';
import { loginSchema, registerSchema } from '../../shared/validation.ts';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth as getFirebaseAdminAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

if (!getApps().length) {
  initializeApp({ projectId: firebaseConfig.projectId });
}

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid registration payload', parsed.error.flatten());
    }

    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
      .get(parsed.data.email) as { id: string } | undefined;

    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }

    const id = generateUserId();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(parsed.data.password);

    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, name, avatar_url, bio,
        skills_json, experience_level, preferred_roles_json,
        timezone, weekly_availability, github_url, portfolio_url,
        is_demo_admin, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)
    `).run(
      id,
      parsed.data.email.toLowerCase(),
      passwordHash,
      parsed.data.name,
      JSON.stringify(parsed.data.skills),
      parsed.data.experienceLevel,
      JSON.stringify(parsed.data.preferredRoles),
      parsed.data.timezone,
      parsed.data.weeklyAvailability,
      now,
      now,
    );

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
    const user = mapUserRow(row);
    const token = signAccessToken(user);
    setAuthCookie(res, token);

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid login credentials', parsed.error.flatten());
    }

    const db = getDb();
    const row = db
      .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)')
      .get(parsed.data.email) as unknown as UserRow | undefined;

    if (!row) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const valid = await verifyPassword(parsed.data.password, row.password_hash);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const user = mapUserRow(row);
    const token = signAccessToken(user);
    setAuthCookie(res, token);

    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/firebase', async (req, res, next) => {
  try {
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
    if (!idToken) {
      throw new AppError(400, 'MISSING_ID_TOKEN', 'Firebase ID token is required');
    }

    let decoded: { uid: string; email?: string; name?: string; picture?: string };
    try {
      decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    } catch {
      throw new AppError(401, 'INVALID_FIREBASE_TOKEN', 'Unable to verify Firebase authentication token');
    }

    if (!decoded.email) {
      throw new AppError(400, 'EMAIL_REQUIRED', 'Google account must have an email address');
    }

    const db = getDb();
    let row = db
      .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)')
      .get(decoded.email) as unknown as UserRow | undefined;

    if (!row) {
      const id = generateUserId();
      const now = new Date().toISOString();
      const randomSecret = await hashPassword(`${decoded.uid}:${Date.now()}`);
      db.prepare(`
        INSERT INTO users (
          id, email, password_hash, name, avatar_url, bio,
          skills_json, experience_level, preferred_roles_json,
          timezone, weekly_availability, github_url, portfolio_url,
          is_demo_admin, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, '[]', 'INTERMEDIATE', '[]', 'UTC', 15, NULL, NULL, 0, ?, ?)
      `).run(
        id,
        decoded.email.toLowerCase(),
        randomSecret,
        decoded.name || decoded.email.split('@')[0],
        decoded.picture || null,
        now,
        now,
      );
      row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
    }

    const user = mapUserRow(row);
    const token = signAccessToken(user);
    setAuthCookie(res, token);

    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});
