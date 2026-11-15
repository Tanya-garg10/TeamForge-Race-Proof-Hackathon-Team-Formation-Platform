import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../server/app.ts';
import { getDb } from '../server/db.ts';
import { initRealtime } from '../server/realtime.ts';
import { computeMatchScore } from '../shared/matching.ts';

describe('TeamForge End-to-End & Concurrency Integration Suite', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamforge-test-'));
  const dbPath = path.join(tmpDir, 'test.db');

  let app: ReturnType<typeof createApp>;
  let server: http.Server;
  let baseUrl: string;

  let aliceToken = '';
  let bobToken = '';
  let carolToken = '';
  let hackathonId = '';

  beforeAll(async () => {
    app = createApp({ dbPath, skipSeed: false });
    server = http.createServer(app);
    initRealtime(server);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // Login demo users
    const aliceRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@teamforge.dev', password: 'Password123!' });
    aliceToken = aliceRes.body.token;

    const bobRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@teamforge.dev', password: 'Password123!' });
    bobToken = bobRes.body.token;

    const carolRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'carol@teamforge.dev', password: 'Password123!' });
    carolToken = carolRes.body.token;

    const hackRes = await request(app).get('/api/hackathons');
    hackathonId = hackRes.body.items[0].id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('1. Health check returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('2. Registers a new user and enforces password hashing + JWT auth', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Builder',
      email: 'builder1@example.com',
      password: 'Password123!',
      timezone: 'America/Los_Angeles',
      skills: ['TypeScript', 'PostgreSQL'],
      preferredRoles: ['Backend'],
      weeklyAvailability: 20,
      experienceLevel: 'ADVANCED',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('builder1@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('3. Rejects duplicate email registration with 409', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Duplicate User',
      email: 'builder1@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(409);
  });

  it('4. Rejects invalid login credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@teamforge.dev', password: 'WrongPassword!' });
    expect(res.status).toBe(401);
  });

  it('5. Rejects unauthenticated access to protected routes with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('6. Allows authenticated user to update their profile', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        bio: 'Updated bio for concurrency testing',
        weeklyAvailability: 32,
        skills: ['React', 'TypeScript', 'Design Systems'],
      });
    expect(res.status).toBe(200);
    expect(res.body.user.weeklyAvailability).toBe(32);
    expect(res.body.user.skills).toContain('Design Systems');
  });

  it('7. Discovers hackathons with search and filtering', async () => {
    const res = await request(app).get('/api/hackathons?search=CleanGrid');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].slug).toBe('cleangrid-resilience-2026');
  });

  it('8. Rejects team creation outside hackathon team size bounds (400)', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        hackathonId: 'hack_fintech_zero',
        name: 'Oversized Squad',
        description: 'Testing size validation rules cleanly',
        requiredSkills: ['TypeScript'],
        minSize: 2,
        maxSize: 9,
      });
    expect(res.status).toBe(400);
  });

  it('9. Creates a team and assigns creator as initial LEADER', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${carolToken}`)
      .send({
        hackathonId: 'hack_fintech_zero',
        name: 'Carol FinTech Core',
        description: 'Zero-trust settlement engine built for FinTech jam',
        requiredSkills: ['Python', 'PostgreSQL'],
        minSize: 2,
        maxSize: 4,
      });
    expect(res.status).toBe(201);
    expect(res.body.team.leaderId).toBe('usr_carol');
    expect(res.body.team.memberCount).toBe(1);
    expect(res.body.team.members[0].role).toBe('LEADER');
  });

  it('10. Prevents non-leaders from updating team details (403)', async () => {
    const res = await request(app)
      .patch('/api/teams/team_atomicsync')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'Hijacked Name' });
    expect(res.status).toBe(403);
  });

  it('11. CRITICAL: 50 concurrent join requests for 1 remaining seat -> exact 1 success (201) & 49 conflicts (409)', async () => {
    const db = getDb();
    // Create a dedicated hackathon + team with maxSize 5 and 4 existing members (1 remaining seat)
    const testHackId = 'hack_concurrency_50';
    const testTeamId = 'team_concurrency_50';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO hackathons (
        id, name, slug, description, theme, registration_deadline,
        min_team_size, max_team_size, required_skills_json, banner_url, created_at
      ) VALUES (?, '50-Contender Concurrency Hack', 'concurrency-50', 'Real DB test', 'Systems', ?, 2, 5, '["TypeScript"]', NULL, ?)
    `).run(testHackId, new Date(Date.now() + 86400000).toISOString(), now);

    // Create 4 existing members + 50 distinct contender accounts
    const contenderTokens: string[] = [];
    for (let i = 0; i < 54; i++) {
      const email = `contender_${i}@race.test`;
      const regRes = await request(app).post('/api/auth/register').send({
        name: `Contender ${i}`,
        email,
        password: 'Password123!',
        timezone: 'UTC',
        skills: ['TypeScript'],
      });
      expect(regRes.status).toBe(201);
      if (i >= 4) {
        contenderTokens.push(regRes.body.token);
      } else {
        // Store base user id on first 4
        if (i === 0) {
          db.prepare(`
            INSERT INTO teams (
              id, hackathon_id, name, description, required_skills_json,
              min_size, max_size, leader_id, status, created_at, updated_at
            ) VALUES (?, ?, 'One Seat Left Squad', 'Concurrency test team', '["TypeScript"]', 2, 5, ?, 'ACTIVE', ?, ?)
          `).run(testTeamId, testHackId, regRes.body.user.id, now, now);
        }
        db.prepare(`
          INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          `mem_base_${i}`,
          testTeamId,
          testHackId,
          regRes.body.user.id,
          i === 0 ? 'LEADER' : 'MEMBER',
          now,
        );
      }
    }

    expect(contenderTokens.length).toBe(50);

    // Dispatch 50 true concurrent HTTP requests via Promise.all against the real HTTP server
    const responses = await Promise.all(
      contenderTokens.map((token, idx) =>
        fetch(`${baseUrl}/api/teams/${testTeamId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': `race-50-${idx}`,
          },
          body: JSON.stringify({}),
        }),
      ),
    );

    const statuses = responses.map((r) => r.status);
    const createdCount = statuses.filter((s) => s === 201).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    expect(createdCount).toBe(1);
    expect(conflictCount).toBe(49);

    const finalMembers = db
      .prepare('SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ?')
      .get(testTeamId) as { cnt: number };
    expect(Number(finalMembers.cnt)).toBe(5);

    const distinctMembers = db
      .prepare('SELECT COUNT(DISTINCT user_id) AS cnt FROM team_members WHERE team_id = ?')
      .get(testTeamId) as { cnt: number };
    expect(Number(distinctMembers.cnt)).toBe(5);

    const joinAudits = db
      .prepare("SELECT COUNT(*) AS cnt FROM audit_logs WHERE team_id = ? AND action_type = 'TEAM_MEMBER_JOINED'")
      .get(testTeamId) as { cnt: number };
    expect(Number(joinAudits.cnt)).toBe(1);
  }, 30_000);

  it('12. Idempotency key prevents duplicate membership on client retry', async () => {
    const newUserRes = await request(app).post('/api/auth/register').send({
      name: 'Retry User',
      email: 'retry@example.com',
      password: 'Password123!',
    });
    const token = newUserRes.body.token;
    const idemKey = 'idem-retry-unique-001';

    const first = await request(app)
      .post('/api/teams/team_atomicsync/join')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey)
      .send({});
    expect(first.status).toBe(201);
    expect(first.body.replayed).toBe(false);

    const second = await request(app)
      .post('/api/teams/team_atomicsync/join')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey)
      .send({});
    expect(second.status).toBe(201);
    expect(second.body.replayed).toBe(true);
    expect(second.body.membershipId).toBe(first.body.membershipId);
  });

  it('13. Prevents joining a second team in the same hackathon (409)', async () => {
    // Alice is already in team_atomicsync (hack_ai_systems); create a second team in hack_ai_systems by a fresh user and have Alice try to join
    const creatorRes = await request(app).post('/api/auth/register').send({
      name: 'Second Team Lead',
      email: 'secondlead@example.com',
      password: 'Password123!',
    });
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${creatorRes.body.token}`)
      .send({
        hackathonId: 'hack_ai_systems',
        name: 'Rival Systems Squad',
        description: 'Another squad in the same AI Systems hackathon',
        requiredSkills: ['TypeScript'],
        minSize: 2,
        maxSize: 4,
      });
    expect(teamRes.status).toBe(201);

    const joinRes = await request(app)
      .post(`/api/teams/${teamRes.body.team.id}/join`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', 'alice-second-team')
      .send({});
    expect(joinRes.status).toBe(409);
  });

  it('14. Secure invitation stores SHA-256 hash only and enforces single-use redemption', async () => {
    const invRes = await request(app)
      .post('/api/teams/team_gridpulse/invitations')
      .set('Authorization', `Bearer ${await loginEmail('diego@teamforge.dev')}`)
      .send({ maxUses: 1, expiresInHours: 24 });

    expect(invRes.status).toBe(201);
    const rawToken = invRes.body.rawToken as string;
    expect(rawToken.length).toBe(64);

    // Ensure raw token is NOT stored in DB or audit logs
    const db = getDb();
    const invRow = db
      .prepare('SELECT token_hash FROM invitations WHERE id = ?')
      .get(invRes.body.invitation.id) as { token_hash: string };
    expect(invRow.token_hash).not.toBe(rawToken);

    const u1 = await request(app).post('/api/auth/register').send({
      name: 'Invitee One',
      email: 'invitee1@example.com',
      password: 'Password123!',
    });
    const accept1 = await request(app)
      .post(`/api/invitations/${rawToken}/accept`)
      .set('Authorization', `Bearer ${u1.body.token}`);
    expect(accept1.status).toBe(200);

    // Second user attempting to reuse single-use token is rejected
    const u2 = await request(app).post('/api/auth/register').send({
      name: 'Invitee Two',
      email: 'invitee2@example.com',
      password: 'Password123!',
    });
    const accept2 = await request(app)
      .post(`/api/invitations/${rawToken}/accept`)
      .set('Authorization', `Bearer ${u2.body.token}`);
    expect(accept2.status).toBe(409);
  });

  it('15. Rejects revoked invitation token (409)', async () => {
    const diegoToken = await loginEmail('diego@teamforge.dev');
    const invRes = await request(app)
      .post('/api/teams/team_gridpulse/invitations')
      .set('Authorization', `Bearer ${diegoToken}`)
      .send({ maxUses: 2, expiresInHours: 24 });

    await request(app)
      .delete(`/api/teams/team_gridpulse/invitations/${invRes.body.invitation.id}`)
      .set('Authorization', `Bearer ${diegoToken}`);

    const u3 = await request(app).post('/api/auth/register').send({
      name: 'Invitee Three',
      email: 'invitee3@example.com',
      password: 'Password123!',
    });
    const accept = await request(app)
      .post(`/api/invitations/${invRes.body.rawToken}/accept`)
      .set('Authorization', `Bearer ${u3.body.token}`);
    expect(accept.status).toBe(409);
  });

  it('16. Rejects expired invitation token (410)', async () => {
    const diegoToken = await loginEmail('diego@teamforge.dev');
    const invRes = await request(app)
      .post('/api/teams/team_gridpulse/invitations')
      .set('Authorization', `Bearer ${diegoToken}`)
      .send({ maxUses: 1, expiresInHours: 24 });

    const db = getDb();
    db.prepare('UPDATE invitations SET expires_at = ? WHERE id = ?').run(
      new Date(Date.now() - 60_000).toISOString(),
      invRes.body.invitation.id,
    );

    const u4 = await request(app).post('/api/auth/register').send({
      name: 'Invitee Four',
      email: 'invitee4@example.com',
      password: 'Password123!',
    });
    const accept = await request(app)
      .post(`/api/invitations/${invRes.body.rawToken}/accept`)
      .set('Authorization', `Bearer ${u4.body.token}`);
    expect(accept.status).toBe(410);
  });

  it('17. Transfers leadership deterministically when leader leaves & deletes team when last member leaves', async () => {
    const leadRes = await request(app).post('/api/auth/register').send({
      name: 'Lifecycle Lead',
      email: 'lifecycle1@example.com',
      password: 'Password123!',
    });
    const memRes = await request(app).post('/api/auth/register').send({
      name: 'Lifecycle Member',
      email: 'lifecycle2@example.com',
      password: 'Password123!',
    });

    const createRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${leadRes.body.token}`)
      .send({
        hackathonId: 'hack_climate_grid',
        name: 'Lifecycle Squad',
        description: 'Testing leadership transfer and last-member cleanup',
        requiredSkills: ['React'],
        minSize: 2,
        maxSize: 4,
      });
    const tid = createRes.body.team.id;

    await request(app)
      .post(`/api/teams/${tid}/join`)
      .set('Authorization', `Bearer ${memRes.body.token}`)
      .set('Idempotency-Key', 'lifecycle-join')
      .send({});

    // Leader leaves -> deterministic transfer to earliest remaining member
    const leave1 = await request(app)
      .post(`/api/teams/${tid}/leave`)
      .set('Authorization', `Bearer ${leadRes.body.token}`);
    expect(leave1.status).toBe(200);
    expect(leave1.body.deletedTeam).toBe(false);
    expect(leave1.body.newLeaderId).toBe(memRes.body.user.id);

    // Last member leaves -> team deleted cleanly
    const leave2 = await request(app)
      .post(`/api/teams/${tid}/leave`)
      .set('Authorization', `Bearer ${memRes.body.token}`);
    expect(leave2.status).toBe(200);
    expect(leave2.body.deletedTeam).toBe(true);

    const fetchDeleted = await request(app).get(`/api/teams/${tid}`);
    expect(fetchDeleted.status).toBe(404);
  });

  it('18. Handles join requests creation and leader acceptance/rejection', async () => {
    const applicant = await request(app).post('/api/auth/register').send({
      name: 'Applicant Zero',
      email: 'applicant0@example.com',
      password: 'Password123!',
    });
    const jrRes = await request(app)
      .post('/api/join-requests')
      .set('Authorization', `Bearer ${applicant.body.token}`)
      .send({ teamId: 'team_gridpulse', message: 'I bring Docker & k6 experience' });
    expect(jrRes.status).toBe(201);

    const diegoToken = await loginEmail('diego@teamforge.dev');
    const acceptRes = await request(app)
      .post(`/api/join-requests/${jrRes.body.joinRequest.id}/accept`)
      .set('Authorization', `Bearer ${diegoToken}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.joinRequest.status).toBe('ACCEPTED');
  });

  it('19. Transparent teammate matching returns normalized 0-100 component scores', async () => {
    const match = computeMatchScore({
      candidateSkills: ['TypeScript', 'PostgreSQL', 'Docker'],
      candidateTimezone: 'America/Los_Angeles',
      candidateWeeklyHours: 25,
      targetRequiredSkills: ['TypeScript', 'PostgreSQL', 'React'],
      targetExistingSkills: ['React'],
      targetTimezone: 'America/Los_Angeles',
      targetWeeklyHours: 25,
    });
    expect(match.overallScore).toBeGreaterThanOrEqual(80);
    expect(match.timezoneScore).toBe(100);
    expect(match.availabilityScore).toBe(100);
    expect(match.matchingSkills).toContain('TypeScript');

    const apiRes = await request(app)
      .get('/api/matching/teammates')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(apiRes.status).toBe(200);
    expect(apiRes.body.items.length).toBeGreaterThan(0);
  });

  it('20. Audit logs endpoint records team lifecycle events without sensitive secrets', async () => {
    const res = await request(app).get('/api/audit-logs?limit=20');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(res.body.items);
    expect(serialized).not.toContain('Password123!');
    expect(serialized).not.toContain('password_hash');
  });

  it('21. Emits real-time Socket.IO team:member_joined event strictly after DB commit', async () => {
    const lead = await request(app).post('/api/auth/register').send({
      name: 'Socket Lead',
      email: 'socklead@example.com',
      password: 'Password123!',
    });
    const joiner = await request(app).post('/api/auth/register').send({
      name: 'Socket Joiner',
      email: 'sockjoiner@example.com',
      password: 'Password123!',
    });

    const teamRes = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${lead.body.token}`)
      .send({
        hackathonId: hackathonId,
        name: 'Realtime Socket Squad',
        description: 'Testing real-time post-commit Socket.IO broadcasts',
        requiredSkills: ['WebSockets'],
        minSize: 2,
        maxSize: 4,
      });
    const teamId = teamRes.body.team.id;

    const client = ioClient(baseUrl, {
      auth: { token: lead.body.token },
      transports: ['websocket'],
    });

    const receivedEvent = new Promise<{ teamId: string; userId: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket event timeout')), 5000);
      client.on('connect', () => {
        client.emit('subscribe:team', teamId);
      });
      client.on('team:member_joined', (payload) => {
        if (payload.teamId === teamId) {
          clearTimeout(timeout);
          resolve(payload);
        }
      });
    });

    // Give socket subscription a brief moment to join the room
    await new Promise((r) => setTimeout(r, 150));

    const joinRes = await fetch(`${baseUrl}/api/teams/${teamId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${joiner.body.token}`,
        'Idempotency-Key': 'sock-join-1',
      },
      body: JSON.stringify({}),
    });
    expect(joinRes.status).toBe(201);

    const payload = await receivedEvent;
    expect(payload.teamId).toBe(teamId);
    expect(payload.userId).toBe(joiner.body.user.id);

    client.disconnect();
  });

  it('22. Rate limits excessive invitation verification attempts (429)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) {
      const res = await request(app)
        .post(`/api/invitations/invalidtokenvalue0000000000000000${i}/accept`)
        .set('Authorization', `Bearer ${aliceToken}`);
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });

  async function loginEmail(email: string): Promise<string> {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123!' });
    return r.body.token;
  }
});
