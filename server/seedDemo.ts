import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb, withTransaction } from './db.ts';

export const DEMO_PASSWORD = 'Password123!';

export function seedInitialDataIfEmpty(): void {
  const db = getDb();
  const existingUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (existingUsers.cnt > 0) {
    db.prepare("UPDATE hackathons SET banner_url = '/src/assets/images/hackathon_fintech_ledger_1794684837393.jpg' WHERE id = 'hack_fintech_zero' AND (banner_url IS NULL OR banner_url = '/src/assets/images/hackathon_ai_systems_1794678733550.jpg')").run();
    db.prepare("UPDATE hackathons SET banner_url = '/src/assets/images/hackathon_bio_compute_1794684837811.jpg' WHERE id = 'hack_bio_compute' AND banner_url IS NULL").run();
    db.prepare("UPDATE hackathons SET banner_url = '/src/assets/images/hackathon_edge_robotics_1794684837668.jpg' WHERE id = 'hack_edge_robotics' AND banner_url IS NULL").run();
    return;
  }

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const now = new Date().toISOString();

  const demoUsers = [
    {
      id: 'usr_alice',
      email: 'alice@teamforge.dev',
      name: 'Alice Chen',
      bio: 'Staff backend & distributed systems engineer specializing in PostgreSQL concurrency and Go/Node microservices.',
      skills: ['TypeScript', 'PostgreSQL', 'Node.js', 'System Design', 'Redis'],
      experienceLevel: 'EXPERT',
      preferredRoles: ['Backend Architect', 'Team Lead'],
      timezone: 'America/Los_Angeles',
      weeklyAvailability: 30,
      githubUrl: 'https://github.com/alicechen-dev',
      portfolioUrl: 'https://alicechen.dev',
      isDemoAdmin: 1,
    },
    {
      id: 'usr_bob',
      email: 'bob@teamforge.dev',
      name: 'Marcus Vance',
      bio: 'Product designer & React frontend specialist focused on crisp typography, accessibility, and real-time interfaces.',
      skills: ['React', 'TypeScript', 'Tailwind CSS', 'Figma', 'UI/UX'],
      experienceLevel: 'ADVANCED',
      preferredRoles: ['Frontend Lead', 'Product Designer'],
      timezone: 'America/New_York',
      weeklyAvailability: 25,
      githubUrl: 'https://github.com/mvance-ui',
      portfolioUrl: 'https://marcusvance.design',
      isDemoAdmin: 0,
    },
    {
      id: 'usr_carol',
      email: 'carol@teamforge.dev',
      name: 'Priya Nair',
      bio: 'Applied ML engineer building vector retrieval pipelines, evaluation harnesses, and low-latency inference APIs.',
      skills: ['Python', 'PyTorch', 'FastAPI', 'Vector DB', 'LLMs'],
      experienceLevel: 'ADVANCED',
      preferredRoles: ['ML Engineer', 'Data Engineer'],
      timezone: 'Europe/London',
      weeklyAvailability: 20,
      githubUrl: 'https://github.com/priyanair-ml',
      portfolioUrl: 'https://priyanair.ai',
      isDemoAdmin: 0,
    },
    {
      id: 'usr_diego',
      email: 'diego@teamforge.dev',
      name: 'Diego Morales',
      bio: 'Full-stack engineer and DevOps generalist passionate about observability, k6 load testing, and Kubernetes.',
      skills: ['TypeScript', 'Docker', 'PostgreSQL', 'k6', 'Kubernetes'],
      experienceLevel: 'INTERMEDIATE',
      preferredRoles: ['Full-Stack Engineer', 'DevOps'],
      timezone: 'America/Los_Angeles',
      weeklyAvailability: 22,
      githubUrl: 'https://github.com/diegomorales',
      portfolioUrl: null,
      isDemoAdmin: 0,
    },
    {
      id: 'usr_elena',
      email: 'elena@teamforge.dev',
      name: 'Elena Rostova',
      bio: 'Security engineer & cryptography researcher focused on zero-trust APIs, OAuth flows, and threat modeling.',
      skills: ['Rust', 'Security', 'Node.js', 'PostgreSQL', 'GraphQL'],
      experienceLevel: 'EXPERT',
      preferredRoles: ['Security Architect', 'Backend Engineer'],
      timezone: 'Europe/Berlin',
      weeklyAvailability: 18,
      githubUrl: 'https://github.com/erostova-sec',
      portfolioUrl: 'https://rostova.sec',
      isDemoAdmin: 0,
    },
    {
      id: 'usr_kenji',
      email: 'kenji@teamforge.dev',
      name: 'Kenji Takahashi',
      bio: 'Mobile & edge-AI developer crafting offline-first collaborative web and native experiences.',
      skills: ['React', 'WebSockets', 'TypeScript', 'Rust', 'WebAssembly'],
      experienceLevel: 'ADVANCED',
      preferredRoles: ['Frontend Engineer', 'Systems Engineer'],
      timezone: 'Asia/Tokyo',
      weeklyAvailability: 28,
      githubUrl: 'https://github.com/ktakahashi',
      portfolioUrl: null,
      isDemoAdmin: 0,
    },
    {
      id: 'usr_admin',
      email: 'admin@teamforge.dev',
      name: 'Nadia Park (Lab Admin)',
      bio: 'Platform reliability engineer overseeing hackathon concurrency stress benchmarks and audit compliance.',
      skills: ['PostgreSQL', 'TypeScript', 'k6', 'Observability', 'Architecture'],
      experienceLevel: 'EXPERT',
      preferredRoles: ['Platform Admin', 'QA Lead'],
      timezone: 'America/Los_Angeles',
      weeklyAvailability: 35,
      githubUrl: 'https://github.com/nadiapark',
      portfolioUrl: null,
      isDemoAdmin: 1,
    },
  ];

  const hackathons = [
    {
      id: 'hack_ai_systems',
      name: 'Global Systems & AI Infrastructure Hack 2026',
      slug: 'global-systems-ai-2026',
      description:
        'Build fault-tolerant developer infrastructure, distributed AI orchestration engines, and high-throughput collaborative tooling over 48 hours.',
      theme: 'AI & Distributed Systems',
      registrationDeadline: new Date(Date.now() + 18 * 86400 * 1000).toISOString(),
      minTeamSize: 2,
      maxTeamSize: 4,
      requiredSkills: ['TypeScript', 'PostgreSQL', 'Python', 'React', 'System Design'],
      bannerUrl: '/src/assets/images/hackathon_ai_systems_1794678733550.jpg',
    },
    {
      id: 'hack_climate_grid',
      name: 'CleanGrid Resilience & Civic Tech Sprint',
      slug: 'cleangrid-resilience-2026',
      description:
        'Design real-time energy telemetry dashboards, microgrid forecasting models, and resilient municipal coordination platforms.',
      theme: 'Climate & Civic Infrastructure',
      registrationDeadline: new Date(Date.now() + 26 * 86400 * 1000).toISOString(),
      minTeamSize: 2,
      maxTeamSize: 5,
      requiredSkills: ['React', 'TypeScript', 'Python', 'PostgreSQL', 'UI/UX'],
      bannerUrl: '/src/assets/images/hackathon_climate_grid_1794678733334.jpg',
    },
    {
      id: 'hack_fintech_zero',
      name: 'Zero-Trust FinTech & Ledger Integrity Jam',
      slug: 'zero-trust-fintech-2026',
      description:
        'Engineer atomic settlement workflows, idempotent payment rails, and verifiable audit trails with sub-50ms p95 API latency.',
      theme: 'FinTech & Security',
      registrationDeadline: new Date(Date.now() + 12 * 86400 * 1000).toISOString(),
      minTeamSize: 2,
      maxTeamSize: 4,
      requiredSkills: ['PostgreSQL', 'Node.js', 'Security', 'Rust', 'TypeScript'],
      bannerUrl: '/src/assets/images/hackathon_fintech_ledger_1794684837393.jpg',
    },
  ];

  const teams = [
    {
      id: 'team_atomicsync',
      hackathonId: 'hack_ai_systems',
      name: 'AtomicSync Guild',
      description:
        'Building a race-proof collaborative state engine with PostgreSQL advisory locks, Socket.IO delta sync, and zero-conflict merges.',
      requiredSkills: ['TypeScript', 'React', 'PostgreSQL', 'Python', 'UI/UX'],
      minSize: 2,
      maxSize: 4,
      leaderId: 'usr_alice',
      members: [
        { userId: 'usr_alice', role: 'LEADER', offsetMins: 180 },
        { userId: 'usr_bob', role: 'MEMBER', offsetMins: 120 },
        { userId: 'usr_carol', role: 'MEMBER', offsetMins: 60 },
      ],
    },
    {
      id: 'team_gridpulse',
      hackathonId: 'hack_climate_grid',
      name: 'GridPulse Collective',
      description:
        'Real-time substation load balancer and predictive solar dispatch UI built for municipal utility operators.',
      requiredSkills: ['React', 'Python', 'PostgreSQL', 'UI/UX', 'Docker'],
      minSize: 2,
      maxSize: 5,
      leaderId: 'usr_diego',
      members: [
        { userId: 'usr_diego', role: 'LEADER', offsetMins: 240 },
        { userId: 'usr_kenji', role: 'MEMBER', offsetMins: 150 },
      ],
    },
    {
      id: 'team_ledgerlock',
      hackathonId: 'hack_fintech_zero',
      name: 'LedgerLock Core',
      description:
        'Double-entry idempotent clearing API with verifiable cryptographic audit logs and automated load verification.',
      requiredSkills: ['Rust', 'Security', 'PostgreSQL', 'Node.js', 'TypeScript'],
      minSize: 2,
      maxSize: 4,
      leaderId: 'usr_elena',
      members: [
        { userId: 'usr_elena', role: 'LEADER', offsetMins: 300 },
        { userId: 'usr_alice', role: 'MEMBER', offsetMins: 200 },
        { userId: 'usr_diego', role: 'MEMBER', offsetMins: 90 },
      ],
    },
  ];

  withTransaction((tx) => {
    const insertUser = tx.prepare(`
      INSERT INTO users (
        id, email, password_hash, name, avatar_url, bio,
        skills_json, experience_level, preferred_roles_json,
        timezone, weekly_availability, github_url, portfolio_url,
        is_demo_admin, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const u of demoUsers) {
      insertUser.run(
        u.id,
        u.email,
        passwordHash,
        u.name,
        null,
        u.bio,
        JSON.stringify(u.skills),
        u.experienceLevel,
        JSON.stringify(u.preferredRoles),
        u.timezone,
        u.weeklyAvailability,
        u.githubUrl,
        u.portfolioUrl,
        u.isDemoAdmin,
        now,
        now,
      );
    }

    const insertHackathon = tx.prepare(`
      INSERT INTO hackathons (
        id, name, slug, description, theme, registration_deadline,
        min_team_size, max_team_size, required_skills_json, banner_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const h of hackathons) {
      insertHackathon.run(
        h.id,
        h.name,
        h.slug,
        h.description,
        h.theme,
        h.registrationDeadline,
        h.minTeamSize,
        h.maxTeamSize,
        JSON.stringify(h.requiredSkills),
        h.bannerUrl,
        now,
      );
    }

    const insertTeam = tx.prepare(`
      INSERT INTO teams (
        id, hackathon_id, name, description, required_skills_json,
        min_size, max_size, leader_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);

    const insertMember = tx.prepare(`
      INSERT INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAudit = tx.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, actor_name, action_type, entity_type, entity_id,
        hackathon_id, team_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of teams) {
      insertTeam.run(
        t.id,
        t.hackathonId,
        t.name,
        t.description,
        JSON.stringify(t.requiredSkills),
        t.minSize,
        t.maxSize,
        t.leaderId,
        now,
        now,
      );

      const leader = demoUsers.find((u) => u.id === t.leaderId);
      insertAudit.run(
        `aud_${crypto.randomUUID().slice(0, 12)}`,
        t.leaderId,
        leader?.name ?? 'Leader',
        'TEAM_CREATED',
        'TEAM',
        t.id,
        t.hackathonId,
        t.id,
        JSON.stringify({ teamName: t.name, maxSize: t.maxSize }),
        now,
      );

      for (const m of t.members) {
        const joinedAt = new Date(Date.now() - m.offsetMins * 60 * 1000).toISOString();
        insertMember.run(
          `mem_${crypto.randomUUID().slice(0, 12)}`,
          t.id,
          t.hackathonId,
          m.userId,
          m.role,
          joinedAt,
        );
        const memberUser = demoUsers.find((u) => u.id === m.userId);
        insertAudit.run(
          `aud_${crypto.randomUUID().slice(0, 12)}`,
          m.userId,
          memberUser?.name ?? 'Member',
          'TEAM_MEMBER_JOINED',
          'TEAM_MEMBER',
          t.id,
          t.hackathonId,
          t.id,
          JSON.stringify({ role: m.role, teamName: t.name }),
          joinedAt,
        );
      }
    }
  });
}
