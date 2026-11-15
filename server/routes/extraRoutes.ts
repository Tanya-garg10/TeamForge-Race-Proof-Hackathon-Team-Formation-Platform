import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb, withTransaction } from '../db.ts';
import { AppError } from '../errors.ts';
import {
  hashPassword,
  mapUserRow,
  requireAuth,
  type AuthenticatedRequest,
  type UserRow,
} from '../auth.ts';
import { createJoinRequestSchema } from '../../shared/validation.ts';
import { computeMatchScore, DEFAULT_MATCHING_WEIGHTS } from '../../shared/matching.ts';
import {
  acceptDirectInvitationById,
  acceptInvitationTransactional,
  declineDirectInvitationById,
} from '../services/invitationService.ts';
import {
  createJoinRequestTransactional,
  listJoinRequests,
  reviewJoinRequestTransactional,
} from '../services/joinRequestService.ts';
import { joinTeamTransactional, listTeams } from '../services/teamService.ts';
import type { AuditLogDTO, PublicUser } from '../../shared/types.ts';

export const invitationRouter = Router();

const inviteVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many invitation verification attempts. Please wait a minute.',
    },
  },
});

invitationRouter.post('/:token/accept', requireAuth, inviteVerifyLimiter, (req: AuthenticatedRequest, res, next) => {
  try {
    const result = acceptInvitationTransactional(String(req.params.token), req.user!);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

invitationRouter.post('/direct/:id/accept', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const result = acceptDirectInvitationById(String(req.params.id), req.user!);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

invitationRouter.post('/direct/:id/decline', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const invitation = declineDirectInvitationById(String(req.params.id), req.user!);
    res.status(200).json({ invitation });
  } catch (err) {
    next(err);
  }
});

export const joinRequestRouter = Router();

joinRequestRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : req.user!.id;
  const items = listJoinRequests(teamId ? { teamId } : { userId });
  res.json({ items });
});

joinRequestRouter.post('/', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = createJoinRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid join request payload', parsed.error.flatten());
    }
    const joinRequest = createJoinRequestTransactional(req.user!, parsed.data);
    res.status(201).json({ joinRequest });
  } catch (err) {
    next(err);
  }
});

joinRequestRouter.post('/:id/accept', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const result = reviewJoinRequestTransactional(String(req.params.id), 'ACCEPT', req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

joinRequestRouter.post('/:id/reject', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const result = reviewJoinRequestTransactional(String(req.params.id), 'REJECT', req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const matchingRouter = Router();

matchingRouter.get('/teammates', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const hackathonId = typeof req.query.hackathonId === 'string' ? req.query.hackathonId : undefined;
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;

  const weights = {
    skills: req.query.wSkills ? Number(req.query.wSkills) : DEFAULT_MATCHING_WEIGHTS.skills,
    timezone: req.query.wTimezone ? Number(req.query.wTimezone) : DEFAULT_MATCHING_WEIGHTS.timezone,
    availability: req.query.wAvailability
      ? Number(req.query.wAvailability)
      : DEFAULT_MATCHING_WEIGHTS.availability,
  };

  let targetRequiredSkills = req.user!.preferredRoles.length ? req.user!.skills : ['TypeScript', 'React', 'PostgreSQL'];
  let targetExistingSkills = req.user!.skills;
  let targetTimezone = req.user!.timezone;
  let targetWeeklyHours = req.user!.weeklyAvailability;
  const excludedUserIds = new Set<string>([req.user!.id]);

  if (teamId) {
    const teams = listTeams({ limit: 50 }).items;
    const team = teams.find((t) => t.id === teamId);
    if (team) {
      targetRequiredSkills = team.requiredSkills;
      const memberSkills = new Set<string>();
      for (const m of team.members ?? []) {
        excludedUserIds.add(m.userId);
        for (const s of m.user.skills) memberSkills.add(s);
      }
      targetExistingSkills = Array.from(memberSkills);
      const leader = team.members?.find((m) => m.role === 'LEADER');
      if (leader) {
        targetTimezone = leader.user.timezone;
        targetWeeklyHours = leader.user.weeklyAvailability;
      }
    }
  } else if (hackathonId) {
    const h = db.prepare('SELECT required_skills_json FROM hackathons WHERE id = ?').get(hackathonId) as
      | { required_skills_json: string }
      | undefined;
    if (h) {
      targetRequiredSkills = JSON.parse(h.required_skills_json);
    }
  }

  const candidateRows = db.prepare('SELECT * FROM users LIMIT 200').all() as unknown as UserRow[];
  const recommendations = candidateRows
    .map(mapUserRow)
    .filter((u) => !excludedUserIds.has(u.id))
    .map((candidate) => ({
      user: candidate,
      match: computeMatchScore({
        candidateSkills: candidate.skills,
        candidateTimezone: candidate.timezone,
        candidateWeeklyHours: candidate.weeklyAvailability,
        targetRequiredSkills,
        targetExistingSkills,
        targetTimezone,
        targetWeeklyHours,
        weights,
      }),
    }))
    .sort((a, b) => b.match.overallScore - a.match.overallScore)
    .slice(0, 12);

  res.json({ items: recommendations, weights });
});

matchingRouter.get('/teams', requireAuth, (req: AuthenticatedRequest, res) => {
  const hackathonId = typeof req.query.hackathonId === 'string' ? req.query.hackathonId : undefined;
  const weights = {
    skills: req.query.wSkills ? Number(req.query.wSkills) : DEFAULT_MATCHING_WEIGHTS.skills,
    timezone: req.query.wTimezone ? Number(req.query.wTimezone) : DEFAULT_MATCHING_WEIGHTS.timezone,
    availability: req.query.wAvailability
      ? Number(req.query.wAvailability)
      : DEFAULT_MATCHING_WEIGHTS.availability,
  };

  const teams = listTeams({ hackathonId, hasOpenSeats: true, limit: 50 }).items;
  const recommendations = teams
    .filter((t) => !(t.members ?? []).some((m) => m.userId === req.user!.id))
    .map((team) => {
      const existingSkills = Array.from(
        new Set((team.members ?? []).flatMap((m) => m.user.skills)),
      );
      const leader = team.members?.find((m) => m.role === 'LEADER');
      return {
        team,
        match: computeMatchScore({
          candidateSkills: req.user!.skills,
          candidateTimezone: req.user!.timezone,
          candidateWeeklyHours: req.user!.weeklyAvailability,
          targetRequiredSkills: team.requiredSkills,
          targetExistingSkills: existingSkills,
          targetTimezone: leader?.user.timezone ?? req.user!.timezone,
          targetWeeklyHours: leader?.user.weeklyAvailability ?? 20,
          weights,
        }),
      };
    })
    .sort((a, b) => b.match.overallScore - a.match.overallScore)
    .slice(0, 12);

  res.json({ items: recommendations, weights });
});

export const auditRouter = Router();

auditRouter.get('/', (req, res) => {
  const db = getDb();
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;
  const hackathonId = typeof req.query.hackathonId === 'string' ? req.query.hackathonId : undefined;
  const actionType = typeof req.query.actionType === 'string' ? req.query.actionType : undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = (page - 1) * limit;

  const clauses: string[] = [];
  const args: (string | number)[] = [];
  if (teamId) {
    clauses.push('team_id = ?');
    args.push(teamId);
  }
  if (hackathonId) {
    clauses.push('hackathon_id = ?');
    args.push(hackathonId);
  }
  if (actionType) {
    clauses.push('action_type = ?');
    args.push(actionType);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...args, limit, offset) as Array<{
    id: string;
    actor_user_id: string;
    actor_name: string | null;
    action_type: string;
    entity_type: string;
    entity_id: string;
    hackathon_id: string | null;
    team_id: string | null;
    metadata_json: string;
    created_at: string;
  }>;

  const count = db
    .prepare(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`)
    .get(...args) as { total: number };

  const items: AuditLogDTO[] = rows.map((r) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    actorName: r.actor_name,
    actionType: r.action_type,
    entityType: r.entity_type,
    entityId: r.entity_id,
    hackathonId: r.hackathon_id,
    teamId: r.team_id,
    metadata: JSON.parse(r.metadata_json || '{}'),
    createdAt: r.created_at,
  }));

  res.json({
    items,
    total: Number(count.total),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(count.total) / limit)),
  });
});

export const adminRouter = Router();

/**
 * Controlled concurrency demonstration endpoint.
 * Restricted to authenticated Demo Admin accounts to prevent abuse as a public attack surface.
 * Creates an ephemeral isolated team with 1 remaining seat, dispatches 50 concurrent
 * Promise.all calls into the REAL joinTeamTransactional service, verifies invariants,
 * and cleans up ephemeral test rows afterward.
 */
adminRouter.post('/concurrency-demo', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user!.isDemoAdmin) {
      throw new AppError(
        403,
        'ADMIN_REQUIRED',
        'Demo admin privileges required to run controlled concurrency benchmark',
      );
    }

    const db = getDb();
    const runId = crypto.randomUUID().slice(0, 8);
    const hackathon = db.prepare('SELECT id FROM hackathons LIMIT 1').get() as { id: string } | undefined;
    if (!hackathon) {
      throw new AppError(404, 'NO_HACKATHON', 'No hackathon found for demo');
    }

    const demoHackathonId = `hack_lab_${runId}`;
    const demoTeamId = `team_lab_${runId}`;
    const now = new Date().toISOString();
    const passwordHash = await hashPassword('SandboxRunner123!');

    const contenders: PublicUser[] = [];
    const baseUsersCount = 4; // 4 existing members in a maxSize=5 team => 1 seat left
    const contenderCount = 50;

    withTransaction((tx) => {
      tx.prepare(`
        INSERT INTO hackathons (
          id, name, slug, description, theme, registration_deadline,
          min_team_size, max_team_size, required_skills_json, banner_url, created_at
        ) VALUES (?, ?, ?, 'Controlled concurrency lab sandbox', 'Verification', ?, 2, 5, '["TypeScript"]', NULL, ?)
      `).run(
        demoHackathonId,
        `Concurrency Sandbox ${runId}`,
        `concurrency-sandbox-${runId}`,
        new Date(Date.now() + 86400000).toISOString(),
        now,
      );

      for (let i = 0; i < baseUsersCount + contenderCount; i++) {
        const uid = `usr_lab_${runId}_${i}`;
        const email = `lab_${runId}_${i}@sandbox.local`;
        const name = i < baseUsersCount ? `Existing Member ${i + 1}` : `Contender #${i - baseUsersCount + 1}`;
        tx.prepare(`
          INSERT INTO users (
            id, email, password_hash, name, avatar_url, bio,
            skills_json, experience_level, preferred_roles_json,
            timezone, weekly_availability, github_url, portfolio_url,
            is_demo_admin, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, NULL, '["TypeScript"]', 'INTERMEDIATE', '[]', 'UTC', 20, NULL, NULL, 0, ?, ?)
        `).run(uid, email, passwordHash, name, now, now);

        if (i >= baseUsersCount) {
          contenders.push({
            id: uid,
            email,
            name,
            avatarUrl: null,
            bio: null,
            skills: ['TypeScript'],
            experienceLevel: 'INTERMEDIATE',
            preferredRoles: [],
            timezone: 'UTC',
            weeklyAvailability: 20,
            githubUrl: null,
            portfolioUrl: null,
            isDemoAdmin: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      tx.prepare(`
        INSERT INTO teams (
          id, hackathon_id, name, description, required_skills_json,
          min_size, max_size, leader_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, 'Lab team with 1 remaining seat', '["TypeScript"]', 2, 5, ?, 'ACTIVE', ?, ?)
      `).run(demoTeamId, demoHackathonId, `Lab Team ${runId}`, `usr_lab_${runId}_0`, now, now);

      for (let i = 0; i < baseUsersCount; i++) {
        tx.prepare(`
          INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          `mem_lab_${runId}_${i}`,
          demoTeamId,
          demoHackathonId,
          `usr_lab_${runId}_${i}`,
          i === 0 ? 'LEADER' : 'MEMBER',
          now,
        );
      }
    });

    const startMs = performance.now();
    const outcomes = await Promise.all(
      contenders.map(async (contender, idx) => {
        try {
          const result = joinTeamTransactional({
            teamId: demoTeamId,
            actor: contender,
            idempotencyKey: `lab-${runId}-req-${idx}`,
          });
          return {
            contender: contender.name,
            status: result.statusCode,
            outcome: 'JOINED' as const,
            message: 'Seat claimed atomically',
          };
        } catch (err) {
          const status = err instanceof AppError ? err.statusCode : 500;
          const message = err instanceof Error ? err.message : 'Conflict';
          return {
            contender: contender.name,
            status,
            outcome: 'REJECTED' as const,
            message,
          };
        }
      }),
    );
    const durationMs = Math.round((performance.now() - startMs) * 100) / 100;

    const finalCountRow = db
      .prepare('SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?')
      .get(demoTeamId) as { cnt: number };
    const auditJoinCountRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM audit_logs WHERE team_id = ? AND action_type = 'TEAM_MEMBER_JOINED'")
      .get(demoTeamId) as { cnt: number };

    const finalMemberCount = Number(finalCountRow.cnt);
    const auditJoinCount = Number(auditJoinCountRow.cnt);

    // Clean up ephemeral lab entities so demo does not pollute user discovery boards
    withTransaction((tx) => {
      tx.prepare('DELETE FROM audit_logs WHERE hackathon_id = ?').run(demoHackathonId);
      tx.prepare('DELETE FROM idempotency_keys WHERE endpoint LIKE ?').run(`%${demoTeamId}%`);
      tx.prepare('DELETE FROM team_members WHERE hackathon_id = ?').run(demoHackathonId);
      tx.prepare('DELETE FROM teams WHERE hackathon_id = ?').run(demoHackathonId);
      tx.prepare('DELETE FROM hackathons WHERE id = ?').run(demoHackathonId);
      tx.prepare('DELETE FROM users WHERE id LIKE ?').run(`usr_lab_${runId}_%`);
    });

    const succeededCount = outcomes.filter((o) => o.outcome === 'JOINED').length;
    const conflictCount = outcomes.filter((o) => o.outcome === 'REJECTED').length;

    res.json({
      runId,
      totalRequests: contenders.length,
      initialMembers: baseUsersCount,
      maxCapacity: 5,
      succeededCount,
      conflictCount,
      finalMemberCount,
      auditJoinCount,
      capacityRespected: finalMemberCount === 5 && succeededCount === 1 && conflictCount === 49,
      durationMs,
      winner: outcomes.find((o) => o.outcome === 'JOINED')?.contender ?? null,
      sampleOutcomes: outcomes.slice(0, 12),
      allOutcomes: outcomes,
    });
  } catch (err) {
    next(err);
  }
});
