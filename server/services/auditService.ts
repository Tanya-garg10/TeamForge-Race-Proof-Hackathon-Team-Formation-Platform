import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

const REDACTED_KEYS = new Set(['password', 'passwordhash', 'token', 'rawtoken', 'jwt', 'secret']);

export function sanitizeAuditMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) continue;
    clean[key] = value;
  }
  return clean;
}

export function writeAuditLog(
  tx: DatabaseSync,
  params: {
    actorUserId: string;
    actorName?: string | null;
    actionType: string;
    entityType: string;
    entityId: string;
    hackathonId?: string | null;
    teamId?: string | null;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  },
): string {
  const id = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const createdAt = params.createdAt ?? new Date().toISOString();
  const safeMeta = sanitizeAuditMetadata(params.metadata ?? {});

  tx.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, actor_name, action_type, entity_type, entity_id,
      hackathon_id, team_id, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.actorUserId,
    params.actorName ?? null,
    params.actionType,
    params.entityType,
    params.entityId,
    params.hackathonId ?? null,
    params.teamId ?? null,
    JSON.stringify(safeMeta),
    createdAt,
  );

  return id;
}
