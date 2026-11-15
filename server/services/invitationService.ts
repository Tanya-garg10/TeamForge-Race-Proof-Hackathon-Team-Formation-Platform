import crypto from 'node:crypto';
import { getDb, withTransaction } from '../db.ts';
import { AppError, isUniqueConstraintError } from '../errors.ts';
import { emitPostCommitEvent } from '../realtime.ts';
import { writeAuditLog } from './auditService.ts';
import { getTeamMembers, mapTeamRow } from './teamService.ts';
import type { InvitationDTO, PublicUser, TeamDTO } from '../../shared/types.ts';

interface InvitationRow {
  id: string;
  team_id: string;
  hackathon_id: string;
  inviter_id: string;
  inviter_name?: string;
  invitee_email: string | null;
  token_hash: string;
  status: InvitationDTO['status'];
  max_uses: number;
  uses_count: number;
  expires_at: string;
  created_at: string;
}

export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function mapInvitationRow(row: InvitationRow): InvitationDTO {
  const isExpired = row.status === 'ACTIVE' && new Date(row.expires_at).getTime() < Date.now();
  return {
    id: row.id,
    teamId: row.team_id,
    hackathonId: row.hackathon_id,
    inviterId: row.inviter_id,
    inviterName: row.inviter_name,
    inviteeEmail: row.invitee_email,
    status: isExpired ? 'EXPIRED' : row.status,
    maxUses: row.max_uses,
    usesCount: row.uses_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function createInvitationTransactional(
  teamId: string,
  actor: PublicUser,
  input: { inviteeEmail?: string | null; maxUses?: number; expiresInHours?: number },
): { invitation: InvitationDTO; rawToken: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);
  const invId = `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const maxUses = input.maxUses ?? 1;
  const expiresInHours = input.expiresInHours ?? 72;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 3600 * 1000).toISOString();

  const invitation = withTransaction((tx) => {
    const team = tx
      .prepare('SELECT id, hackathon_id, leader_id, status, name FROM teams WHERE id = ?')
      .get(teamId) as
      | { id: string; hackathon_id: string; leader_id: string; status: string; name: string }
      | undefined;

    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }
    if (team.leader_id !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the team leader can issue invitations');
    }
    if (team.status !== 'ACTIVE') {
      throw new AppError(409, 'TEAM_NOT_ACTIVE', 'Cannot invite to a non-active team');
    }

    tx.prepare(`
      INSERT INTO invitations (
        id, team_id, hackathon_id, inviter_id, invitee_email, token_hash,
        status, max_uses, uses_count, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 0, ?, ?)
    `).run(
      invId,
      team.id,
      team.hackathon_id,
      actor.id,
      input.inviteeEmail ?? null,
      tokenHash,
      maxUses,
      expiresAt,
      now.toISOString(),
    );

    // Never store raw token in audit log metadata
    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'INVITATION_CREATED',
      entityType: 'INVITATION',
      entityId: invId,
      hackathonId: team.hackathon_id,
      teamId: team.id,
      metadata: {
        invitationId: invId,
        maxUses,
        expiresAt,
        hasEmailRestriction: Boolean(input.inviteeEmail),
      },
      createdAt: now.toISOString(),
    });

    const row = tx
      .prepare(
        'SELECT i.*, u.name AS inviter_name FROM invitations i JOIN users u ON u.id = i.inviter_id WHERE i.id = ?',
      )
      .get(invId) as unknown as InvitationRow;

    return mapInvitationRow(row);
  });

  emitPostCommitEvent(
    'invitation:created',
    { teamId, hackathonId: invitation.hackathonId, invitation },
    [`team:${teamId}`],
  );

  return { invitation, rawToken };
}

export function listTeamInvitations(teamId: string, actor: PublicUser): InvitationDTO[] {
  const db = getDb();
  const team = db.prepare('SELECT leader_id FROM teams WHERE id = ?').get(teamId) as
    | { leader_id: string }
    | undefined;
  if (!team) {
    throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }
  if (team.leader_id !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'Only the team leader can view team invitations');
  }

  const rows = db
    .prepare(
      'SELECT i.*, u.name AS inviter_name FROM invitations i JOIN users u ON u.id = i.inviter_id WHERE i.team_id = ? ORDER BY i.created_at DESC',
    )
    .all(teamId) as unknown as InvitationRow[];

  return rows.map(mapInvitationRow);
}

export function listMyPendingInvitations(actor: PublicUser): Array<InvitationDTO & { teamName: string; hackathonName: string }> {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT i.*, u.name AS inviter_name, t.name AS team_name, h.name AS hackathon_name
      FROM invitations i
      JOIN users u ON u.id = i.inviter_id
      JOIN teams t ON t.id = i.team_id
      JOIN hackathons h ON h.id = i.hackathon_id
      WHERE LOWER(i.invitee_email) = LOWER(?)
        AND i.status = 'ACTIVE'
        AND i.uses_count < i.max_uses
      ORDER BY i.created_at DESC
    `)
    .all(actor.email) as unknown as Array<InvitationRow & { team_name: string; hackathon_name: string }>;

  return rows.map((r) => ({
    ...mapInvitationRow(r),
    teamName: r.team_name,
    hackathonName: r.hackathon_name,
  }));
}

export function listAllUserInvitations(actor: PublicUser) {
  const db = getDb();
  type EnrichedRow = InvitationRow & { team_name: string; hackathon_name: string };

  const receivedRows = db
    .prepare(`
      SELECT i.*, u.name AS inviter_name, t.name AS team_name, h.name AS hackathon_name
      FROM invitations i
      JOIN users u ON u.id = i.inviter_id
      JOIN teams t ON t.id = i.team_id
      JOIN hackathons h ON h.id = i.hackathon_id
      WHERE LOWER(i.invitee_email) = LOWER(?)
      ORDER BY i.created_at DESC
    `)
    .all(actor.email) as unknown as EnrichedRow[];

  const sentRows = db
    .prepare(`
      SELECT i.*, u.name AS inviter_name, t.name AS team_name, h.name AS hackathon_name
      FROM invitations i
      JOIN users u ON u.id = i.inviter_id
      JOIN teams t ON t.id = i.team_id
      JOIN hackathons h ON h.id = i.hackathon_id
      WHERE i.inviter_id = ?
      ORDER BY i.created_at DESC
    `)
    .all(actor.id) as unknown as EnrichedRow[];

  const mapEnriched = (r: EnrichedRow) => ({
    ...mapInvitationRow(r),
    teamName: r.team_name,
    hackathonName: r.hackathon_name,
  });

  const receivedAll = receivedRows.map(mapEnriched);
  const sentAll = sentRows.map(mapEnriched);

  return {
    received: receivedAll.filter((i) => i.status === 'ACTIVE' && i.usesCount < i.maxUses),
    sent: sentAll.filter((i) => i.status === 'ACTIVE' && i.usesCount < i.maxUses),
    expired: [...receivedAll, ...sentAll].filter(
      (i, idx, arr) =>
        arr.findIndex((x) => x.id === i.id) === idx &&
        (i.status !== 'ACTIVE' || i.usesCount >= i.maxUses),
    ),
  };
}

export function acceptDirectInvitationById(
  invitationId: string,
  actor: PublicUser,
): { team: TeamDTO; invitationId: string } {
  const res = withTransaction((tx) => {
    const inv = tx
      .prepare('SELECT * FROM invitations WHERE id = ?')
      .get(invitationId) as InvitationRow | undefined;

    if (!inv) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    }
    if (!inv.invitee_email || inv.invitee_email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new AppError(403, 'FORBIDDEN', 'You can only accept direct invitations addressed to your email');
    }
    if (inv.status === 'REVOKED') {
      throw new AppError(409, 'INVITATION_REVOKED', 'This invitation has been revoked');
    }
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      tx.prepare("UPDATE invitations SET status = 'EXPIRED' WHERE id = ?").run(inv.id);
      throw new AppError(410, 'INVITATION_EXPIRED', 'This invitation has expired');
    }
    if (inv.status !== 'ACTIVE' || inv.uses_count >= inv.max_uses) {
      throw new AppError(409, 'INVITATION_EXHAUSTED', 'This invitation has already been used');
    }

    const team = tx
      .prepare(
        'SELECT t.*, h.name AS hackathon_name FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?',
      )
      .get(inv.team_id) as
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

    if (!team || team.status !== 'ACTIVE') {
      throw new AppError(409, 'TEAM_NOT_ACTIVE', 'Target team is no longer active');
    }

    const existingMembership = tx
      .prepare('SELECT team_id FROM team_members WHERE hackathon_id = ? AND user_id = ?')
      .get(team.hackathon_id, actor.id) as { team_id: string } | undefined;
    if (existingMembership) {
      throw new AppError(409, 'ALREADY_IN_HACKATHON_TEAM', 'You already belong to a team in this hackathon');
    }

    const countRow = tx
      .prepare('SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?')
      .get(team.id) as { cnt: number };
    if (Number(countRow.cnt) >= team.max_size) {
      throw new AppError(409, 'TEAM_FULL', 'Team is already at maximum capacity');
    }

    const now = new Date().toISOString();
    const nextUses = inv.uses_count + 1;
    tx.prepare('UPDATE invitations SET uses_count = ?, status = ? WHERE id = ?').run(
      nextUses,
      nextUses >= inv.max_uses ? 'ACCEPTED' : 'ACTIVE',
      inv.id,
    );

    const membershipId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    tx.prepare(`
      INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, 'MEMBER', ?)
    `).run(membershipId, team.id, team.hackathon_id, actor.id, now);

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'INVITATION_ACCEPTED',
      entityType: 'INVITATION',
      entityId: inv.id,
      hackathonId: team.hackathon_id,
      teamId: team.id,
      metadata: { invitationId: inv.id, teamName: team.name },
      createdAt: now,
    });

    return {
      team: mapTeamRow(team, getTeamMembers(tx, team.id)),
      invitationId: inv.id,
    };
  });

  emitPostCommitEvent(
    'invitation:accepted',
    { teamId: res.team.id, hackathonId: res.team.hackathonId, invitationId: res.invitationId, userId: actor.id, team: res.team },
    [`team:${res.team.id}`, `hackathon:${res.team.hackathonId}`, 'board'],
  );
  emitPostCommitEvent(
    'team:member_joined',
    { teamId: res.team.id, hackathonId: res.team.hackathonId, userId: actor.id, userName: actor.name, team: res.team },
    [`team:${res.team.id}`, `hackathon:${res.team.hackathonId}`, 'board'],
  );
  emitPostCommitEvent(
    'board:updated',
    { action: 'invitation_accepted', teamId: res.team.id, hackathonId: res.team.hackathonId, team: res.team },
    ['board', `hackathon:${res.team.hackathonId}`],
  );

  return res;
}

export function declineDirectInvitationById(invitationId: string, actor: PublicUser): InvitationDTO {
  return withTransaction((tx) => {
    const inv = tx
      .prepare('SELECT * FROM invitations WHERE id = ?')
      .get(invitationId) as InvitationRow | undefined;

    if (!inv) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    }
    if (!inv.invitee_email || inv.invitee_email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new AppError(403, 'FORBIDDEN', 'You can only decline invitations addressed to your email');
    }
    tx.prepare("UPDATE invitations SET status = 'REVOKED' WHERE id = ?").run(inv.id);
    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'INVITATION_DECLINED',
      entityType: 'INVITATION',
      entityId: inv.id,
      hackathonId: inv.hackathon_id,
      teamId: inv.team_id,
      metadata: { invitationId: inv.id },
    });
    const updated = tx
      .prepare('SELECT i.*, u.name AS inviter_name FROM invitations i JOIN users u ON u.id = i.inviter_id WHERE i.id = ?')
      .get(inv.id) as unknown as InvitationRow;
    return mapInvitationRow(updated);
  });
}

export function revokeInvitationTransactional(
  teamId: string,
  invitationId: string,
  actor: PublicUser,
): InvitationDTO {
  return withTransaction((tx) => {
    const team = tx.prepare('SELECT id, hackathon_id, leader_id FROM teams WHERE id = ?').get(teamId) as
      | { id: string; hackathon_id: string; leader_id: string }
      | undefined;
    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }
    if (team.leader_id !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the team leader can revoke invitations');
    }

    const inv = tx
      .prepare('SELECT * FROM invitations WHERE id = ? AND team_id = ?')
      .get(invitationId, teamId) as InvitationRow | undefined;
    if (!inv) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
    }
    if (inv.status === 'REVOKED') {
      return mapInvitationRow(inv);
    }

    tx.prepare("UPDATE invitations SET status = 'REVOKED' WHERE id = ?").run(invitationId);

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'INVITATION_REVOKED',
      entityType: 'INVITATION',
      entityId: invitationId,
      hackathonId: team.hackathon_id,
      teamId,
      metadata: { invitationId },
    });

    const updated = tx
      .prepare('SELECT i.*, u.name AS inviter_name FROM invitations i JOIN users u ON u.id = i.inviter_id WHERE i.id = ?')
      .get(invitationId) as unknown as InvitationRow;
    return mapInvitationRow(updated);
  });
}

export function acceptInvitationTransactional(
  rawToken: string,
  actor: PublicUser,
): { team: TeamDTO; invitationId: string } {
  if (!rawToken || rawToken.length < 16) {
    throw new AppError(400, 'INVALID_TOKEN', 'Malformed invitation token');
  }

  const tokenHash = hashInvitationToken(rawToken);
  const res = withTransaction((tx) => {
    const inv = tx
      .prepare('SELECT * FROM invitations WHERE token_hash = ?')
      .get(tokenHash) as InvitationRow | undefined;

    if (!inv) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation token is invalid or does not exist');
    }

    if (inv.status === 'REVOKED') {
      throw new AppError(409, 'INVITATION_REVOKED', 'This invitation has been revoked');
    }

    if (new Date(inv.expires_at).getTime() < Date.now()) {
      tx.prepare("UPDATE invitations SET status = 'EXPIRED' WHERE id = ?").run(inv.id);
      throw new AppError(410, 'INVITATION_EXPIRED', 'This invitation has expired');
    }

    if (inv.status !== 'ACTIVE' || inv.uses_count >= inv.max_uses) {
      throw new AppError(409, 'INVITATION_EXHAUSTED', 'This invitation has already been used');
    }

    if (inv.invitee_email && inv.invitee_email.toLowerCase() !== actor.email.toLowerCase()) {
      throw new AppError(403, 'INVITATION_EMAIL_MISMATCH', 'This invitation was issued for a different email address');
    }

    const team = tx
      .prepare(
        'SELECT t.*, h.name AS hackathon_name FROM teams t JOIN hackathons h ON h.id = t.hackathon_id WHERE t.id = ?',
      )
      .get(inv.team_id) as
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

    if (!team || team.status !== 'ACTIVE') {
      throw new AppError(409, 'TEAM_NOT_ACTIVE', 'Target team is no longer active');
    }

    const existingHackathonMembership = tx
      .prepare('SELECT team_id FROM team_members WHERE hackathon_id = ? AND user_id = ?')
      .get(team.hackathon_id, actor.id) as { team_id: string } | undefined;

    if (existingHackathonMembership) {
      throw new AppError(
        409,
        'ALREADY_IN_HACKATHON_TEAM',
        'You already belong to a team in this hackathon',
      );
    }

    const countRow = tx
      .prepare('SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?')
      .get(team.id) as { cnt: number };

    if (Number(countRow.cnt) >= team.max_size) {
      throw new AppError(409, 'TEAM_FULL', 'Team is already at maximum capacity');
    }

    const now = new Date().toISOString();
    const nextUses = inv.uses_count + 1;
    const nextStatus = nextUses >= inv.max_uses ? 'ACCEPTED' : 'ACTIVE';

    tx.prepare('UPDATE invitations SET uses_count = ?, status = ? WHERE id = ?').run(
      nextUses,
      nextStatus,
      inv.id,
    );

    const membershipId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    try {
      tx.prepare(`
        INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?, 'MEMBER', ?)
      `).run(membershipId, team.id, team.hackathon_id, actor.id, now);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new AppError(409, 'MEMBERSHIP_CONFLICT', 'Conflicting hackathon membership');
      }
      throw err;
    }

    writeAuditLog(tx, {
      actorUserId: actor.id,
      actorName: actor.name,
      actionType: 'INVITATION_ACCEPTED',
      entityType: 'INVITATION',
      entityId: inv.id,
      hackathonId: team.hackathon_id,
      teamId: team.id,
      metadata: {
        invitationId: inv.id,
        teamName: team.name,
        usesCount: nextUses,
        maxUses: inv.max_uses,
      },
      createdAt: now,
    });

    return {
      team: mapTeamRow(team, getTeamMembers(tx, team.id)),
      invitationId: inv.id,
    };
  });

  emitPostCommitEvent(
    'invitation:accepted',
    {
      teamId: res.team.id,
      hackathonId: res.team.hackathonId,
      invitationId: res.invitationId,
      userId: actor.id,
      userName: actor.name,
      team: res.team,
    },
    [`team:${res.team.id}`, `hackathon:${res.team.hackathonId}`, 'board'],
  );
  emitPostCommitEvent(
    'team:member_joined',
    {
      teamId: res.team.id,
      hackathonId: res.team.hackathonId,
      userId: actor.id,
      userName: actor.name,
      team: res.team,
    },
    [`team:${res.team.id}`, `hackathon:${res.team.hackathonId}`, 'board'],
  );
  emitPostCommitEvent(
    'board:updated',
    {
      action: 'invitation_accepted',
      teamId: res.team.id,
      hackathonId: res.team.hackathonId,
      team: res.team,
    },
    ['board', `hackathon:${res.team.hackathonId}`],
  );

  return res;
}
