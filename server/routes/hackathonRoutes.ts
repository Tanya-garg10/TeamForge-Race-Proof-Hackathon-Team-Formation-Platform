import { Router } from 'express';
import { getDb } from '../db.ts';
import { AppError } from '../errors.ts';
import { safeJsonArray } from '../auth.ts';
import { listTeams } from '../services/teamService.ts';
import type { Hackathon } from '../../shared/types.ts';

interface HackathonRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  theme: string;
  registration_deadline: string;
  min_team_size: number;
  max_team_size: number;
  required_skills_json: string;
  banner_url: string | null;
  created_at: string;
  current_team_count: number;
}

function mapHackathonRow(r: HackathonRow): Hackathon {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    theme: r.theme,
    registrationDeadline: r.registration_deadline,
    minTeamSize: r.min_team_size,
    maxTeamSize: r.max_team_size,
    requiredSkills: safeJsonArray(r.required_skills_json),
    bannerUrl: r.banner_url,
    currentTeamCount: Number(r.current_team_count ?? 0),
    createdAt: r.created_at,
  };
}

export const hackathonRouter = Router();

hackathonRouter.get('/', (req, res) => {
  const db = getDb();
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const theme = typeof req.query.theme === 'string' ? req.query.theme.trim().toLowerCase() : '';
  const skill = typeof req.query.skill === 'string' ? req.query.skill.trim().toLowerCase() : '';
  const openOnly = req.query.openOnly === 'true';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const clauses: string[] = [];
  const args: (string | number)[] = [];

  if (search) {
    clauses.push('(LOWER(h.name) LIKE ? OR LOWER(h.description) LIKE ? OR LOWER(h.theme) LIKE ?)');
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (theme) {
    clauses.push('LOWER(h.theme) LIKE ?');
    args.push(`%${theme}%`);
  }
  if (skill) {
    clauses.push('LOWER(h.required_skills_json) LIKE ?');
    args.push(`%${skill}%`);
  }
  if (openOnly) {
    clauses.push('h.registration_deadline > ?');
    args.push(new Date().toISOString());
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT h.*, COUNT(t.id) AS current_team_count
      FROM hackathons h
      LEFT JOIN teams t ON t.hackathon_id = h.id AND t.status = 'ACTIVE'
      ${whereSql}
      GROUP BY h.id
      ORDER BY h.registration_deadline ASC
      LIMIT ? OFFSET ?
    `)
    .all(...args, limit, offset) as unknown as HackathonRow[];

  const count = db
    .prepare(`SELECT COUNT(*) AS total FROM hackathons h ${whereSql}`)
    .get(...args) as { total: number };

  res.json({
    items: rows.map(mapHackathonRow),
    total: Number(count.total),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(count.total) / limit)),
  });
});

hackathonRouter.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const row = db
      .prepare(`
        SELECT h.*, COUNT(t.id) AS current_team_count
        FROM hackathons h
        LEFT JOIN teams t ON t.hackathon_id = h.id AND t.status = 'ACTIVE'
        WHERE h.id = ? OR h.slug = ?
        GROUP BY h.id
      `)
      .get(req.params.id, req.params.id) as unknown as HackathonRow | undefined;

    if (!row) {
      throw new AppError(404, 'HACKATHON_NOT_FOUND', 'Hackathon not found');
    }

    const teams = listTeams({ hackathonId: row.id, limit: 50 });
    res.json({
      hackathon: mapHackathonRow(row),
      teams: teams.items,
    });
  } catch (err) {
    next(err);
  }
});
