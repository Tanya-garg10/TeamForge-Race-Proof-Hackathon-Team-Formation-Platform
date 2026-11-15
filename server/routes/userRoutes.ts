import { Router } from 'express';
import { getDb } from '../db.ts';
import { AppError } from '../errors.ts';
import {
  mapUserRow,
  requireAuth,
  type AuthenticatedRequest,
  type UserRow,
} from '../auth.ts';
import { updateProfileSchema } from '../../shared/validation.ts';
import { getTeamDetails } from '../services/teamService.ts';
import { listAllUserInvitations, listMyPendingInvitations } from '../services/invitationService.ts';

export const userRouter = Router();

userRouter.get('/', (req, res) => {
  const db = getDb();
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const skill = typeof req.query.skill === 'string' ? req.query.skill.trim().toLowerCase() : '';
  const timezone = typeof req.query.timezone === 'string' ? req.query.timezone.trim().toLowerCase() : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const clauses: string[] = [];
  const args: (string | number)[] = [];

  if (search) {
    clauses.push('(LOWER(name) LIKE ? OR LOWER(bio) LIKE ?)');
    args.push(`%${search}%`, `%${search}%`);
  }
  if (skill) {
    clauses.push('LOWER(skills_json) LIKE ?');
    args.push(`%${skill}%`);
  }
  if (timezone) {
    clauses.push('LOWER(timezone) LIKE ?');
    args.push(`%${timezone}%`);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, offset) as unknown as UserRow[];

  const count = db
    .prepare(`SELECT COUNT(*) AS total FROM users ${whereSql}`)
    .get(...args) as { total: number };

  res.json({
    items: rows.map(mapUserRow),
    total: Number(count.total),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(count.total) / limit)),
  });
});

userRouter.get('/me/teams', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT team_id FROM team_members WHERE user_id = ? ORDER BY joined_at DESC')
    .all(req.user!.id) as Array<{ team_id: string }>;

  const teams = rows.map((r) => getTeamDetails(r.team_id));
  res.json({ items: teams });
});

userRouter.get('/me/invitations', requireAuth, (req: AuthenticatedRequest, res) => {
  const invitations = listMyPendingInvitations(req.user!);
  res.json({ items: invitations });
});

userRouter.get('/me/invitations/all', requireAuth, (req: AuthenticatedRequest, res) => {
  const grouped = listAllUserInvitations(req.user!);
  res.json(grouped);
});

userRouter.patch('/me', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid profile update', parsed.error.flatten());
    }

    const db = getDb();
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as unknown as UserRow;
    const d = parsed.data;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE users SET
        name = ?,
        avatar_url = ?,
        bio = ?,
        skills_json = ?,
        experience_level = ?,
        preferred_roles_json = ?,
        timezone = ?,
        weekly_availability = ?,
        github_url = ?,
        portfolio_url = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      d.name ?? current.name,
      d.avatarUrl === '' ? null : d.avatarUrl !== undefined ? d.avatarUrl : current.avatar_url,
      d.bio !== undefined ? d.bio : current.bio,
      d.skills ? JSON.stringify(d.skills) : current.skills_json,
      d.experienceLevel ?? current.experience_level,
      d.preferredRoles ? JSON.stringify(d.preferredRoles) : current.preferred_roles_json,
      d.timezone ?? current.timezone,
      d.weeklyAvailability ?? current.weekly_availability,
      d.githubUrl === '' ? null : d.githubUrl !== undefined ? d.githubUrl : current.github_url,
      d.portfolioUrl === '' ? null : d.portfolioUrl !== undefined ? d.portfolioUrl : current.portfolio_url,
      now,
      req.user!.id,
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as unknown as UserRow;
    res.json({ user: mapUserRow(updated) });
  } catch (err) {
    next(err);
  }
});

userRouter.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as UserRow | undefined;
    if (!row) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    res.json({ user: mapUserRow(row) });
  } catch (err) {
    next(err);
  }
});
