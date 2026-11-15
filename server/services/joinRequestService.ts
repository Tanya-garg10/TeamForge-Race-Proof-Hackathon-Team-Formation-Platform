import crypto from 'node:crypto';
import { getDb, withTransaction } from '../db.ts';
import { AppError, isUniqueConstraintError } from '../errors.ts';
import { mapUserRow, type UserRow } from '../auth.ts';
import { emitPostCommitEvent } from '../realtime.ts';
import { writeAuditLog } from './auditService.ts';
import { getTeamMembers, mapTeamRow } from './teamService.ts';
import type { JoinRequestDTO, PublicUser, TeamDTO } from '../../shared/types.ts';

interface JoinRequestRow {
  id: string;
  team_id: string;
  team_name?: string;
  hackathon_id: string;
  user_id: string;
  message: string | null;
  status: JoinRequestDTO['status'];
  created_at: string;
  reviewed_at: string | null;
}

export function createJoinRequestTransactional(
  actor: PublicUser,
  input: { teamId: string; message?: string | null },
): JoinRequestDTO {
  const reqId = `jr_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const now = new Date().toISOString();

  return withTransaction((tx) => {
    const team = tx
      .prepare('SELECT id, hackathon_id, name, status, max_size FROM teams WHERE id = ?')
      .get(input.teamId) as
      | { id: string; hackathon_id: string; name: string; status: string; max_size: number }
      | undefined;

    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Target team not found');
    }
    if (team.status !== 'ACTIVE') {
      throw new AppError(409, 'TEAM_NOT_ACTIVE', 'Team is not accepting requests');
    }

    const existingMembership = tx
      .prepare('SELECT team_id FROM team_members WHERE hackathon_id = ? AND user_id = ?')
      .get(team.hackathon_id, actor.id) as { team_id: string } | undefined;
    if (existingMembership) {
      throw new AppError(409, 'ALREADY_IN_HACKATHON_TEAM', 'You are already in a team for this hackathon');
    }

    const existingPending = tx
      .prepare("SELECT id FROM join_requests WHERE team_id = ? AND user_id = ? AND status = 'PENDING'")
      .get(team.id, actor.id) as { id: string } | undefined;
    if (existingPending) {
      throw new AppError(409, 'JOIN_REQUEST_EXISTS', 'You already have a pending request for this team');
    }

    tx.prepare(`
      INSERT INTO join_requests (id, team_id, hackathon_id, user_id, message, status, created_at, reviewed_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NULL)
    `).run(reqId, team.id, team.hackathon_id, actor.id, input.message ?? null, now);

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'JOIN_REQUEST_CREATED',
      entityType: 'JOIN_REQUEST',
      entityId: reqId,
      hackathonId: team.hackathon_id,
      teamId: team.id,
      metadata: { teamName: team.name },
      createdAt: now,
    });

    return {
      id: reqId,
      teamId: team.id,
      teamName: team.name,
      hackathonId: team.hackathon_id,
      userId: actor.id,
      user: actor,
      message: input.message ?? null,
      status: 'PENDING',
      createdAt: now,
      reviewedAt: null,
    };
  });
}

export function listJoinRequests(filters: { teamId?: string; userId?: string }): JoinRequestDTO[] {
  const db = getDb();
  const clauses: string[] = [];
  const args: string[] = [];

  if (filters.teamId) {
    clauses.push('jr.team_id = ?');
    args.push(filters.teamId);
  }
  if (filters.userId) {
    clauses.push('jr.user_id = ?');
    args.push(filters.userId);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT jr.*, t.name AS team_name
      FROM join_requests jr
      JOIN teams t ON t.id = jr.team_id
      ${whereSql}
      ORDER BY jr.created_at DESC
    `)
    .all(...args) as unknown as JoinRequestRow[];

  return rows.map((r) => {
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(r.user_id) as UserRow | undefined;
    return {
      id: r.id,
      teamId: r.team_id,
      teamName: r.team_name,
      hackathonId: r.hackathon_id,
      userId: r.user_id,
      user: userRow ? mapUserRow(userRow) : undefined,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    };
  });
}

export function reviewJoinRequestTransactional(
  requestId: string,
  decision: 'ACCEPT' | 'REJECT',
  actor: PublicUser,
): { joinRequest: JoinRequestDTO; team: TeamDTO } {
  const res = withTransaction((tx) => {
    const jr = tx
      .prepare('SELECT * FROM join_requests WHERE id = ?')
      .get(requestId) as JoinRequestRow | undefined;

    if (!jr) {
      throw new AppError(404, 'JOIN_REQUEST_NOT_FOUND', 'Join request not found');
    }
    if (jr.status !== 'PENDING') {
      throw new AppError(409, 'JOIN_REQUEST_ALREADY_REVIEWED', 'This join request was already reviewed');
    }

    const team = tx
      .prepare('SELECT t.*, h.name AS hackathon_name FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?')
      .get(jr.team_id) as
      | {
          id: string;
          hackathon_id: string;
          hackathon_name: string;
          name: string;
          description: string;
          required_skills_json: string;
          min_size: number;
          max_size: number;
          leader_id: string;
          status: TeamDTO['status'];
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }
    if (team.leader_id !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the team leader can accept or reject join requests');
    }

    const now = new Date().toISOString();

    if (decision === 'REJECT') {
      tx.prepare("UPDATE join_requests SET status = 'REJECTED', reviewed_at = ? WHERE id = ?").run(
        now,
        jr.id,
      );
      writeAuditLog(tx, {
        actorUserId: actor.id,
        actorName: actor.name,
        actionType: 'JOIN_REQUEST_REJECTED',
        entityType: 'JOIN_REQUEST',
        entityId: jr.id,
        hackathonId: team.hackathon_id,
        teamId: team.id,
        metadata: { applicantUserId: jr.user_id },
        createdAt: now,
      });
      return {
        joinRequest: {
          id: jr.id,
          teamId: jr.team_id,
          teamName: team.name,
          hackathonId: jr.hackathon_id,
          userId: jr.user_id,
          message: jr.message,
          status: 'REJECTED' as const,
          createdAt: jr.created_at,
          reviewedAt: now,
        },
        team: mapTeamRow(team, getTeamMembers(tx, team.id)),
      };
    }

    // ACCEPT path: atomic capacity + hackathon uniqueness verification
    const existingHackathonMembership = tx
      .prepare('SELECT team_id FROM team_members WHERE hackathon_id = ? AND user_id = ?')
      .get(team.hackathon_id, jr.user_id) as { team_id: string } | undefined;

    if (existingHackathonMembership) {
      throw new AppError(
        409,
        'ALREADY_IN_HACKATHON_TEAM',
        'Applicant already belongs to a team in this hackathon',
      );
    }

    const countRow = tx
      .prepare('SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?')
      .get(team.id) as { cnt: number };
    if (Number(countRow.cnt) >= team.max_size) {
      throw new AppError(409, 'TEAM_FULL', 'Team is already at maximum capacity');
    }

    const membershipId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    try {
      tx.prepare(`
        INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?, 'MEMBER', ?)
      `).run(membershipId, team.id, team.hackathon_id, jr.user_id, now);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Conflicting hackathon membership');
      }
      throw err;
    }

    tx.prepare("UPDATE join_requests SET status = 'ACCEPTED', reviewed_at = ? WHERE id = ?").run(
      now,
      jr.id,
    );

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'JOIN_REQUEST_ACCEPTED',
      entityType: 'JOIN_REQUEST',
      entityId: jr.id,
      hackathonId: team.hackathon_id,
      teamId: team.id,
      metadata: { applicantUserId: jr.user_id, membershipId },
      createdAt: now,
    });

    return {
      joinRequest: {
        id: jr.id,
        teamId: jr.team_id,
        teamName: team.name,
        hackathonId: jr.hackathon_id,
        userId: jr.user_id,
        message: jr.message,
        status: 'ACCEPTED' as const,
        createdAt: jr.created_at,
        reviewedAt: now,
      },
      team: mapTeamRow(team, getTeamMembers(tx, team.id)),
    };
  });

  if (decision === 'ACCEPT') {
    emitPostCommitEvent(
      'team:member_joined',
      {
        teamId: res.team.id,
        hackathonId: res.team.hackathonId,
        userId: res.joinRequest.userId,
        team: res.team,
      },
      [`team:${res.team.id}`, `hackathon:${res.team.hackathonId}`, 'board'],
    );
    emitPostCommitEvent(
      'board:updated',
      {
        action: 'join_request_accepted',
        teamId: res.team.id,
        hackathonId: res.team.hackathonId,
        team: res.team,
      },
      ['board', `hackathon:${res.team.hackathonId}`],
    );
  }

  return res;
}
