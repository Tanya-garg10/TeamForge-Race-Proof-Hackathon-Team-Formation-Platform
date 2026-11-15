import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getDb, withTransaction } from '../db.ts';
import { AppError, isUniqueConstraintError } from '../errors.ts';
import { safeJsonArray } from '../auth.ts';
import { emitPostCommitEvent } from '../realtime.ts';
import { writeAuditLog } from './auditService.ts';
import type { PublicUser, TeamDTO, TeamMemberDTO } from '../../shared/types.ts';

interface TeamRow {
  id: string;
  hackathon_id: string;
  hackathon_name?: string;
  name: string;
  description: string;
  required_skills_json: string;
  min_size: number;
  max_size: number;
  leader_id: string;
  status: TeamDTO['status'];
  created_at: string;
  updated_at: string;
  member_count?: number;
}

interface MemberWithUserRow {
  id: string;
  team_id: string;
  hackathon_id: string;
  user_id: string;
  role: TeamMemberDTO['role'];
  joined_at: string;
  user_name: string;
  user_avatar_url: string | null;
  user_skills_json: string;
  user_experience_level: PublicUser['experienceLevel'];
  user_preferred_roles_json: string;
  user_timezone: string;
  user_weekly_availability: number;
  user_github_url: string | null;
}

export function getTeamMembers(db: DatabaseSync, teamId: string): TeamMemberDTO[] {
  const rows = db
    .prepare(`
      SELECT
        tm.id, tm.team_id, tm.hackathon_id, tm.user_id, tm.role, tm.joined_at,
        u.name AS user_name, u.avatar_url AS user_avatar_url,
        u.skills_json AS user_skills_json, u.experience_level AS user_experience_level,
        u.preferred_roles_json AS user_preferred_roles_json, u.timezone AS user_timezone,
        u.weekly_availability AS user_weekly_availability, u.github_url AS user_github_url
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ?
      ORDER BY CASE WHEN tm.role = 'LEADER' THEN 0 ELSE 1 END, tm.joined_at ASC
    `)
    .all(teamId) as unknown as MemberWithUserRow[];

  return rows.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    hackathonId: r.hackathon_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at,
    user: {
      id: r.user_id,
      name: r.user_name,
      avatarUrl: r.user_avatar_url,
      skills: safeJsonArray(r.user_skills_json),
      experienceLevel: r.user_experience_level,
      preferredRoles: safeJsonArray(r.user_preferred_roles_json),
      timezone: r.user_timezone,
      weeklyAvailability: r.user_weekly_availability,
      githubUrl: r.user_github_url,
    },
  }));
}

export function mapTeamRow(row: TeamRow, members?: TeamMemberDTO[]): TeamDTO {
  const memberCount = members ? members.length : Number(row.member_count ?? 0);
  return {
    id: row.id,
    hackathonId: row.hackathon_id,
    hackathonName: row.hackathon_name,
    name: row.name,
    description: row.description,
    requiredSkills: safeJsonArray(row.required_skills_json),
    minSize: row.min_size,
    maxSize: row.max_size,
    leaderId: row.leader_id,
    status: row.status,
    memberCount,
    openSeats: Math.max(0, row.max_size - memberCount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(members ? { members } : {}),
  };
}

export function listTeams(filters: {
  hackathonId?: string;
  skill?: string;
  hasOpenSeats?: boolean;
  timezone?: string;
  experienceLevel?: string;
  maxCapacity?: number;
  sort?: 'newest' | 'open_seats' | 'most_members';
  search?: string;
  page?: number;
  limit?: number;
}) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = ["t.status = 'ACTIVE'"];
  const args: (string | number)[] = [];

  if (filters.hackathonId) {
    whereClauses.push('t.hackathon_id = ?');
    args.push(filters.hackathonId);
  }
  if (filters.search) {
    whereClauses.push('(LOWER(t.name) LIKE ? OR LOWER(t.description) LIKE ?)');
    const q = `%${filters.search.toLowerCase()}%`;
    args.push(q, q);
  }
  if (filters.skill) {
    whereClauses.push('LOWER(t.required_skills_json) LIKE ?');
    args.push(`%${filters.skill.toLowerCase()}%`);
  }
  if (filters.timezone) {
    whereClauses.push(
      'EXISTS (SELECT 1 FROM team_members tm2 JOIN users u2 ON u2.id = tm2.user_id WHERE tm2.team_id = t.id AND LOWER(u2.timezone) LIKE ?)',
    );
    args.push(`%${filters.timezone.toLowerCase()}%`);
  }
  if (filters.experienceLevel) {
    whereClauses.push(
      'EXISTS (SELECT 1 FROM team_members tm3 JOIN users u3 ON u3.id = tm3.user_id WHERE tm3.team_id = t.id AND tm3.role = \'LEADER\' AND u3.experience_level = ?)',
    );
    args.push(filters.experienceLevel);
  }
  if (filters.maxCapacity && Number.isFinite(filters.maxCapacity)) {
    whereClauses.push('t.max_size <= ?');
    args.push(filters.maxCapacity);
  }

  const havingClause = filters.hasOpenSeats ? 'HAVING COUNT(tm.id) < t.max_size' : '';
  const whereSql = whereClauses.join(' AND ');
  const orderBy =
    filters.sort === 'open_seats'
      ? '(t.max_size - COUNT(tm.id)) DESC, t.created_at DESC'
      : filters.sort === 'most_members'
        ? 'COUNT(tm.id) DESC, t.created_at DESC'
        : 't.created_at DESC';

  const rows = db
    .prepare(`
      SELECT
        t.*, h.name AS hackathon_name, COUNT(tm.id) AS member_count
      FROM teams t
      JOIN hackathons h ON h.id = t.hackathon_id
      LEFT JOIN team_members tm ON tm.team_id = t.id
      WHERE ${whereSql}
      GROUP BY t.id
      ${havingClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `)
    .all(...args, limit, offset) as unknown as TeamRow[];

  const countRows = db
    .prepare(`
      SELECT COUNT(*) AS total FROM (
        SELECT t.id
        FROM teams t
        LEFT JOIN team_members tm ON tm.team_id = t.id
        WHERE ${whereSql}
        GROUP BY t.id
        ${havingClause}
      )
    `)
    .get(...args) as { total: number };

  const teams = rows.map((row) => {
    const members = getTeamMembers(db, row.id);
    return mapTeamRow(row, members);
  });

  return {
    items: teams,
    total: Number(countRows?.total ?? 0),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(countRows?.total ?? 0) / limit)),
  };
}

export function getTeamDetails(teamId: string): TeamDTO {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT t.*, h.name AS hackathon_name
      FROM teams t
      JOIN hackathons h ON h.id = t.hackathon_id
      WHERE t.id = ?
    `)
    .get(teamId) as TeamRow | undefined;

  if (!row) {
    throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }
  const members = getTeamMembers(db, row.id);
  return mapTeamRow(row, members);
}

export function createTeamTransactional(
  actor: PublicUser,
  input: {
    hackathonId: string;
    name: string;
    description: string;
    requiredSkills: string[];
    minSize: number;
    maxSize: number;
  },
): TeamDTO {
  const teamId = `team_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const now = new Date().toISOString();

  const created = withTransaction((tx) => {
    const hackathon = tx
      .prepare('SELECT * FROM hackathons WHERE id = ?')
      .get(input.hackathonId) as
      | {
          id: string;
          name: string;
          registration_deadline: string;
          min_team_size: number;
          max_team_size: number;
        }
      | undefined;

    if (!hackathon) {
      throw new AppError(404, 'HACKATHON_NOT_FOUND', 'Selected hackathon does not exist');
    }

    if (new Date(hackathon.registration_deadline).getTime() < Date.now()) {
      throw new AppError(409, 'DEADLINE_PASSED', 'Registration deadline for this hackathon has passed');
    }

    if (input.minSize < hackathon.min_team_size || input.maxSize > hackathon.max_team_size) {
      throw new AppError(
        400,
        'INVALID_TEAM_SIZE',
        `Team size must stay within hackathon bounds (${hackathon.min_team_size}–${hackathon.max_team_size} members)`,
      );
    }

    const existingMembership = tx
      .prepare('SELECT team_id FROM team_members WHERE hackathon_id = ? AND user_id = ?')
      .get(input.hackathonId, actor.id) as { team_id: string } | undefined;

    if (existingMembership) {
      throw new AppError(
        409,
        'ALREADY_IN_HACKATHON_TEAM',
        'You already belong to a team in this hackathon',
      );
    }

    try {
      tx.prepare(`
        INSERT INTO teams (
          id, hackathon_id, name, description, required_skills_json,
          min_size, max_size, leader_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(
        teamId,
        input.hackathonId,
        input.name,
        input.description,
        JSON.stringify(input.requiredSkills),
        input.minSize,
        input.maxSize,
        actor.id,
        now,
        now,
      );

      tx.prepare(`
        INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?, 'LEADER', ?)
      `).run(`mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`, teamId, input.hackathonId, actor.id, now);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new AppError(
          409,
          'TEAM_CONFLICT',
          'A team with this name already exists in the hackathon or you are already on a team',
        );
      }
      throw err;
    }

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'TEAM_CREATED',
      entityType: 'TEAM',
      entityId: teamId,
      hackathonId: input.hackathonId,
      teamId,
      metadata: {
        teamName: input.name,
        minSize: input.minSize,
        maxSize: input.maxSize,
      },
      createdAt: now,
    });

    const row = tx
      .prepare('SELECT t.*, h.name AS hackathon_name FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?')
      .get(teamId) as unknown as TeamRow;
    const members = getTeamMembers(tx, teamId);
    return mapTeamRow(row, members);
  });

  emitPostCommitEvent(
    'board:updated',
    { action: 'team_created', teamId: created.id, hackathonId: created.hackathonId, team: created },
    ['board', `hackathon:${created.hackathonId}`],
  );

  return created;
}

export interface JoinTeamResult {
  statusCode: number;
  replayed: boolean;
  team: TeamDTO;
  membershipId: string;
}

/**
 * RACE-PROOF TRANSACTIONAL JOIN ENGINE
 *
 * Uses SQLite BEGIN IMMEDIATE (serializable exclusive write lock before reads,
 * functionally identical to PostgreSQL SELECT ... FOR UPDATE) + idempotency key lookup
 * + UNIQUE(hackathon_id, user_id) constraint + strict capacity guard.
 */
export function joinTeamTransactional(params: {
  teamId: string;
  actor: PublicUser;
  idempotencyKey?: string;
}): JoinTeamResult {
  const endpoint = `POST:/api/teams/${params.teamId}/join`;
  const effectiveKey = params.idempotencyKey?.trim() || null;

  let committedResult: JoinTeamResult | null = null;

  committedResult = withTransaction((tx) => {
    if (effectiveKey) {
      const cached = tx
        .prepare(
          'SELECT status_code, response_json FROM idempotency_keys WHERE user_id = ? AND endpoint = ? AND idempotency_key = ?',
        )
        .get(params.actor.id, endpoint, effectiveKey) as
        | { status_code: number; response_json: string }
        | undefined;

      if (cached) {
        const parsed = JSON.parse(cached.response_json) as {
          team: TeamDTO;
          membershipId: string;
        };
        return {
          statusCode: cached.status_code,
          replayed: true,
          team: parsed.team,
          membershipId: parsed.membershipId,
        };
      }
    }

    const team = tx
      .prepare(
        'SELECT t.*, h.name AS hackathon_name, h.registration_deadline FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?',
      )
      .get(params.teamId) as (TeamRow & { registration_deadline: string }) | undefined;

    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Target team does not exist');
    }

    if (team.status !== 'ACTIVE') {
      throw new AppError(409, 'TEAM_NOT_ACTIVE', 'This team is currently locked or archived');
    }

    if (new Date(team.registration_deadline).getTime() < Date.now()) {
      throw new AppError(409, 'DEADLINE_PASSED', 'Hackathon registration deadline has passed');
    }

    const existingSameTeam = tx
      .prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(team.id, params.actor.id) as { id: string } | undefined;

    if (existingSameTeam) {
      throw new AppError(409, 'ALREADY_MEMBER', 'You are already a member of this team');
    }

    const existingHackathonMembership = tx
      .prepare('SELECT team_id FROM team_members WHERE hackathon_id = ? AND user_id = ?')
      .get(team.hackathon_id, params.actor.id) as { team_id: string } | undefined;

    if (existingHackathonMembership) {
      throw new AppError(
        409,
        'ALREADY_IN_HACKATHON_TEAM',
        'You already belong to an active team in this hackathon',
      );
    }

    const countRow = tx
      .prepare('SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?')
      .get(team.id) as { cnt: number };

    if (Number(countRow.cnt) >= team.max_size) {
      throw new AppError(409, 'TEAM_FULL', 'Team has reached maximum seat capacity');
    }

    const now = new Date().toISOString();
    const membershipId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;

    try {
      tx.prepare(`
        INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?, 'MEMBER', ?)
      `).run(membershipId, team.id, team.hackathon_id, params.actor.id, now);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new AppError(
          409,
          'MEMBERSHIP_CONFLICT',
          'Database unique constraint rejected duplicate hackathon membership',
        );
      }
      throw err;
    }

    writeAuditLog(tx, {
      actorUserId: params.actor.id,
      actorName: params.actor.name,
      actionType: 'TEAM_MEMBER_JOINED',
      entityType: 'TEAM_MEMBER',
      entityId: team.id,
      hackathonId: team.hackathon_id,
      teamId: team.id,
      metadata: {
        teamName: team.name,
        membershipId,
        seatNumber: Number(countRow.cnt) + 1,
        maxSize: team.max_size,
      },
      createdAt: now,
    });

    const members = getTeamMembers(tx, team.id);
    const updatedTeam = mapTeamRow(team, members);

    if (effectiveKey) {
      tx.prepare(`
        INSERT INTO idempotency_keys (id, user_id, endpoint, idempotency_key, status_code, response_json, created_at)
        VALUES (?, ?, ?, ?, 201, ?, ?)
      `).run(
        `idem_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
        params.actor.id,
        endpoint,
        effectiveKey,
        JSON.stringify({ team: updatedTeam, membershipId }),
        now,
      );
    }

    return {
      statusCode: 201,
      replayed: false,
      team: updatedTeam,
      membershipId,
    };
  });

  // Emit Socket.IO events strictly AFTER successful transaction commit
  if (!committedResult.replayed) {
    emitPostCommitEvent(
      'team:member_joined',
      {
        teamId: committedResult.team.id,
        hackathonId: committedResult.team.hackathonId,
        userId: params.actor.id,
        userName: params.actor.name,
        team: committedResult.team,
      },
      [`team:${committedResult.team.id}`, `hackathon:${committedResult.team.hackathonId}`, 'board'],
    );
    emitPostCommitEvent(
      'board:updated',
      {
        action: 'member_joined',
        teamId: committedResult.team.id,
        hackathonId: committedResult.team.hackathonId,
        team: committedResult.team,
      },
      ['board', `hackathon:${committedResult.team.hackathonId}`],
    );
  }

  return committedResult;
}

export interface LeaveTeamResult {
  deletedTeam: boolean;
  newLeaderId: string | null;
  teamId: string;
  hackathonId: string;
  team: TeamDTO | null;
}

export function leaveTeamTransactional(teamId: string, actor: PublicUser): LeaveTeamResult {
  const result = withTransaction((tx) => {
    const team = tx
      .prepare('SELECT t.*, h.name AS hackathon_name FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?')
      .get(teamId) as TeamRow | undefined;

    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    const membership = tx
      .prepare('SELECT id, role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, actor.id) as { id: string; role: TeamMemberDTO['role'] } | undefined;

    if (!membership) {
      throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'You are not a member of this team');
    }

    const now = new Date().toISOString();
    tx.prepare('DELETE FROM team_members WHERE id = ?').run(membership.id);

    const remaining = tx
      .prepare(
        'SELECT tm.id, tm.user_id, tm.role, u.name AS user_name FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ? ORDER BY tm.joined_at ASC, tm.user_id ASC',
      )
      .all(teamId) as unknown as Array<{ id: string; user_id: string; role: string; user_name: string }>;

    if (remaining.length === 0) {
      tx.prepare('DELETE FROM invitations WHERE team_id = ?').run(teamId);
      tx.prepare('DELETE FROM join_requests WHERE team_id = ?').run(teamId);
      tx.prepare('DELETE FROM teams WHERE id = ?').run(teamId);

      writeAuditLog(tx, {
        actorUserId: actor.id,
        actorName: actor.name,
        actionType: 'TEAM_DELETED',
        entityType: 'TEAM',
        entityId: teamId,
        hackathonId: team.hackathon_id,
        teamId,
        metadata: { reason: 'LAST_MEMBER_LEFT', teamName: team.name },
        createdAt: now,
      });

      return {
        deletedTeam: true,
        newLeaderId: null,
        teamId,
        hackathonId: team.hackathon_id,
        team: null,
      };
    }

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'TEAM_MEMBER_LEFT',
      entityType: 'TEAM_MEMBER',
      entityId: teamId,
      hackathonId: team.hackathon_id,
      teamId,
      metadata: { teamName: team.name, previousRole: membership.role },
      createdAt: now,
    });

    let newLeaderId: string | null = null;
    if (membership.role === 'LEADER' || team.leader_id === actor.id) {
      const nextLeader = remaining[0];
      newLeaderId = nextLeader.user_id;
      tx.prepare("UPDATE team_members SET role = 'LEADER' WHERE id = ?").run(nextLeader.id);
      tx.prepare('UPDATE teams SET leader_id = ?, updated_at = ? WHERE id = ?').run(
        newLeaderId,
        now,
        teamId,
      );

      writeAuditLog(tx, {
        actorUserId: actor.id,
        actorName: actor.name,
        actionType: 'LEADERSHIP_TRANSFERRED',
        entityType: 'TEAM',
        entityId: teamId,
        hackathonId: team.hackathon_id,
        teamId,
        metadata: {
          previousLeaderId: actor.id,
          newLeaderId,
          newLeaderName: nextLeader.user_name,
          reason: 'LEADER_LEFT_DETERMINISTIC_PROMOTION',
        },
        createdAt: now,
      });
    } else {
      tx.prepare('UPDATE teams SET updated_at = ? WHERE id = ?').run(now, teamId);
    }

    const updatedRow = tx
      .prepare('SELECT t.*, h.name AS hackathon_name FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?')
      .get(teamId) as unknown as TeamRow;
    const members = getTeamMembers(tx, teamId);

    return {
      deletedTeam: false,
      newLeaderId,
      teamId,
      hackathonId: team.hackathon_id,
      team: mapTeamRow(updatedRow, members),
    };
  });

  if (result.deletedTeam) {
    emitPostCommitEvent(
      'team:deleted',
      { teamId: result.teamId, hackathonId: result.hackathonId },
      [`team:${result.teamId}`, `hackathon:${result.hackathonId}`, 'board'],
    );
  } else {
    emitPostCommitEvent(
      'team:member_left',
      {
        teamId: result.teamId,
        hackathonId: result.hackathonId,
        userId: actor.id,
        team: result.team,
      },
      [`team:${result.teamId}`, `hackathon:${result.hackathonId}`, 'board'],
    );
    if (result.newLeaderId) {
      emitPostCommitEvent(
        'team:leader_changed',
        {
          teamId: result.teamId,
          hackathonId: result.hackathonId,
          newLeaderId: result.newLeaderId,
          team: result.team,
        },
        [`team:${result.teamId}`, `hackathon:${result.hackathonId}`, 'board'],
      );
    }
  }

  emitPostCommitEvent(
    'board:updated',
    {
      action: result.deletedTeam ? 'team_deleted' : 'member_left',
      teamId: result.teamId,
      hackathonId: result.hackathonId,
    },
    ['board', `hackathon:${result.hackathonId}`],
  );

  return result;
}

export function updateTeamTransactional(
  teamId: string,
  actor: PublicUser,
  patch: { name?: string; description?: string; requiredSkills?: string[]; maxSize?: number },
): TeamDTO {
  const updated = withTransaction((tx) => {
    const team = tx
      .prepare(
        'SELECT t.*, h.name AS hackathon_name, h.max_team_size FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?',
      )
      .get(teamId) as (TeamRow & { max_team_size: number }) | undefined;

    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }
    if (team.leader_id !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the team leader can update team settings');
    }

    const currentMembers = tx
      .prepare('SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?')
      .get(teamId) as { cnt: number };

    const nextMaxSize = patch.maxSize ?? team.max_size;
    if (nextMaxSize < Number(currentMembers.cnt)) {
      throw new AppError(
        409,
        'CAPACITY_BELOW_MEMBERS',
        'Cannot reduce maximum team size below current member count',
      );
    }
    if (nextMaxSize < team.min_size || nextMaxSize > team.max_team_size) {
      throw new AppError(400, 'INVALID_TEAM_SIZE', 'Maximum size violates hackathon bounds');
    }

    const now = new Date().toISOString();
    tx.prepare(`
      UPDATE teams
      SET name = ?, description = ?, required_skills_json = ?, max_size = ?, updated_at = ?
      WHERE id = ?
    `).run(
      patch.name ?? team.name,
      patch.description ?? team.description,
      patch.requiredSkills ? JSON.stringify(patch.requiredSkills) : team.required_skills_json,
      nextMaxSize,
      now,
      teamId,
    );

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'TEAM_UPDATED',
      entityType: 'TEAM',
      entityId: teamId,
      hackathonId: team.hackathon_id,
      teamId,
      metadata: { updatedFields: Object.keys(patch) },
      createdAt: now,
    });

    const row = tx
      .prepare('SELECT t.*, h.name AS hackathon_name FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?')
      .get(teamId) as unknown as TeamRow;
    return mapTeamRow(row, getTeamMembers(tx, teamId));
  });

  emitPostCommitEvent(
    'team:updated',
    { teamId: updated.id, hackathonId: updated.hackathonId, team: updated },
    [`team:${updated.id}`, `hackathon:${updated.hackathonId}`, 'board'],
  );
  emitPostCommitEvent(
    'board:updated',
    { action: 'team_updated', teamId: updated.id, hackathonId: updated.hackathonId, team: updated },
    ['board', `hackathon:${updated.hackathonId}`],
  );

  return updated;
}

export function deleteTeamTransactional(teamId: string, actor: PublicUser): { hackathonId: string } {
  const res = withTransaction((tx) => {
    const team = tx.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as TeamRow | undefined;
    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }
    if (team.leader_id !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the team leader can delete the team');
    }

    tx.prepare('DELETE FROM invitations WHERE team_id = ?').run(teamId);
    tx.prepare('DELETE FROM join_requests WHERE team_id = ?').run(teamId);
    tx.prepare('DELETE FROM team_members WHERE team_id = ?').run(teamId);
    tx.prepare('DELETE FROM teams WHERE id = ?').run(teamId);

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'TEAM_DELETED',
      entityType: 'TEAM',
      entityId: teamId,
      hackathonId: team.hackathon_id,
      teamId,
      metadata: { reason: 'LEADER_DELETED', teamName: team.name },
    });

    return { hackathonId: team.hackathon_id };
  });

  emitPostCommitEvent(
    'team:deleted',
    { teamId, hackathonId: res.hackathonId },
    [`team:${teamId}`, `hackathon:${res.hackathonId}`, 'board'],
  );
  emitPostCommitEvent(
    'board:updated',
    { action: 'team_deleted', teamId, hackathonId: res.hackathonId },
    ['board', `hackathon:${res.hackathonId}`],
  );

  return res;
}

export function removeMemberTransactional(
  teamId: string,
  targetUserId: string,
  actor: PublicUser,
): TeamDTO {
  if (targetUserId === actor.id) {
    throw new AppError(400, 'USE_LEAVE_ENDPOINT', 'Use the leave endpoint to leave your own team');
  }

  const updated = withTransaction((tx) => {
    const team = tx
      .prepare('SELECT t.*, h.name AS hackathon_name FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?')
      .get(teamId) as TeamRow | undefined;
    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }
    if (team.leader_id !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the team leader can remove members');
    }

    const membership = tx
      .prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, targetUserId) as { id: string } | undefined;
    if (!membership) {
      throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Target user is not a member of this team');
    }

    tx.prepare('DELETE FROM team_members WHERE id = ?').run(membership.id);
    const now = new Date().toISOString();
    tx.prepare('UPDATE teams SET updated_at = ? WHERE id = ?').run(now, teamId);

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'TEAM_MEMBER_REMOVED',
      entityType: 'TEAM_MEMBER',
      entityId: teamId,
      hackathonId: team.hackathon_id,
      teamId,
      metadata: { removedUserId: targetUserId },
      createdAt: now,
    });

    return mapTeamRow(team, getTeamMembers(tx, teamId));
  });

  emitPostCommitEvent(
    'team:member_left',
    { teamId, hackathonId: updated.hackathonId, userId: targetUserId, team: updated },
    [`team:${teamId}`, `hackathon:${updated.hackathonId}`, 'board'],
  );
  emitPostCommitEvent(
    'board:updated',
    { action: 'member_removed', teamId, hackathonId: updated.hackathonId, team: updated },
    ['board', `hackathon:${updated.hackathonId}`],
  );

  return updated;
}
