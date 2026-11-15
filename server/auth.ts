import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from './db.ts';
import { AppError } from './errors.ts';
import type { PublicUser } from '../shared/types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'teamforge-dev-jwt-secret-change-in-prod-2026';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  sub: string;
  email: string;
  isDemoAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  skills_json: string;
  experience_level: PublicUser['experienceLevel'];
  preferred_roles_json: string;
  timezone: string;
  weekly_availability: number;
  github_url: string | null;
  portfolio_url: string | null;
  is_demo_admin: number;
  created_at: string;
  updated_at: string;
}

export function mapUserRow(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    skills: safeJsonArray(row.skills_json),
    experienceLevel: row.experience_level,
    preferredRoles: safeJsonArray(row.preferred_roles_json),
    timezone: row.timezone,
    weeklyAvailability: row.weekly_availability,
    githubUrl: row.github_url,
    portfolioUrl: row.portfolio_url,
    isDemoAdmin: Boolean(row.is_demo_admin),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function safeJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(user: PublicUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    isDemoAdmin: user.isDemoAdmin,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = req.cookies?.tf_token;
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  return null;
}

export function getUserById(id: string): PublicUser | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? mapUserRow(row) : null;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication token is required'));
    return;
  }
  try {
    const decoded = verifyAccessToken(token);
    const user = getUserById(decoded.sub);
    if (!user) {
      next(new AppError(401, 'UNAUTHORIZED', 'User account no longer exists'));
      return;
    }
    req.user = user;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token'));
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractTokenFromRequest(req);
  if (!token) {
    next();
    return;
  }
  try {
    const decoded = verifyAccessToken(token);
    const user = getUserById(decoded.sub);
    if (user) {
      req.user = user;
    }
  } catch {
    // ignore invalid optional token
  }
  next();
}

export function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('tf_token', token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('tf_token', { path: '/' });
}

export function generateUserId(): string {
  return `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
