import bcrypt from 'bcryptjs';
import { initDatabase, withTransaction } from '../server/db.ts';
import { seedInitialDataIfEmpty } from '../server/seedDemo.ts';

const SKILLS_POOL = [
  'TypeScript',
  'React',
  'PostgreSQL',
  'Node.js',
  'Python',
  'Rust',
  'Go',
  'Docker',
  'Kubernetes',
  'UI/UX',
  'GraphQL',
  'PyTorch',
  'WebSockets',
  'k6',
  'Security',
];

const ROLES_POOL = [
  'Backend Engineer',
  'Frontend Lead',
  'Full-Stack Engineer',
  'ML Engineer',
  'Product Designer',
  'Systems Architect',
  'DevOps Engineer',
];

const TIMEZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'UTC',
];

const EXP_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function runBulkSeed() {
  const start = performance.now();
  const db = initDatabase();
  seedInitialDataIfEmpty();

  const existingCount = (db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number }).cnt;
  if (existingCount >= 10_000) {
    console.log(`Database already contains ${existingCount} users. Skipping bulk seed.`);
    return;
  }

  const rand = mulberry32(20261114);
  const sharedHash = await bcrypt.hash('Password123!', 8);
  const now = new Date().toISOString();

  const TOTAL_USERS = 10_000;
  const TOTAL_TEAMS = 2_000;
  const hackathons = [
    'hack_ai_systems',
    'hack_climate_grid',
    'hack_fintech_zero',
    'hack_bio_compute',
    'hack_edge_robotics',
  ];

  console.log('Seeding 10,000 users, 5 hackathons, 2,000 teams, and deterministic memberships...');

  withTransaction((tx) => {
    const insertHack = tx.prepare(`
      INSERT OR IGNORE INTO hackathons (
        id, name, slug, description, theme, registration_deadline,
        min_team_size, max_team_size, required_skills_json, banner_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertHack.run(
      'hack_bio_compute',
      'Computational Biology & Protein Folding Sprint',
      'comp-bio-2026',
      'High-throughput genomics pipelines and molecular visualization apps.',
      'BioTech & AI',
      new Date(Date.now() + 30 * 86400000).toISOString(),
      2,
      5,
      JSON.stringify(['Python', 'PyTorch', 'React', 'PostgreSQL']),
      '/src/assets/images/hackathon_bio_compute_1794684837811.jpg',
      now,
    );
    insertHack.run(
      'hack_edge_robotics',
      'Autonomous Edge Robotics & Telemetry Jam',
      'edge-robotics-2026',
      'Low-latency WebRTC control planes and Rust firmware simulators.',
      'Robotics & Systems',
      new Date(Date.now() + 21 * 86400000).toISOString(),
      2,
      4,
      JSON.stringify(['Rust', 'WebSockets', 'TypeScript', 'Docker']),
      '/src/assets/images/hackathon_edge_robotics_1794684837668.jpg',
      now,
    );

    const insertUser = tx.prepare(`
      INSERT OR IGNORE INTO users (
        id, email, password_hash, name, avatar_url, bio,
        skills_json, experience_level, preferred_roles_json,
        timezone, weekly_availability, github_url, portfolio_url,
        is_demo_admin, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)
    `);

    for (let i = 1; i <= TOTAL_USERS; i++) {
      const uid = `usr_seed_${String(i).padStart(5, '0')}`;
      const s1 = SKILLS_POOL[Math.floor(rand() * SKILLS_POOL.length)];
      const s2 = SKILLS_POOL[Math.floor(rand() * SKILLS_POOL.length)];
      const s3 = SKILLS_POOL[Math.floor(rand() * SKILLS_POOL.length)];
      const skills = Array.from(new Set([s1, s2, s3]));
      const role = ROLES_POOL[Math.floor(rand() * ROLES_POOL.length)];
      const tz = TIMEZONES[Math.floor(rand() * TIMEZONES.length)];
      const exp = EXP_LEVELS[Math.floor(rand() * EXP_LEVELS.length)];
      const hours = 10 + Math.floor(rand() * 31);

      insertUser.run(
        uid,
        `seed.user.${i}@teamforge.dev`,
        sharedHash,
        `Builder #${i}`,
        `Deterministic seeded participant specializing in ${skills.join(', ')}.`,
        JSON.stringify(skills),
        exp,
        JSON.stringify([role]),
        tz,
        hours,
        now,
        now,
      );
    }

    const insertTeam = tx.prepare(`
      INSERT OR IGNORE INTO teams (
        id, hackathon_id, name, description, required_skills_json,
        min_size, max_size, leader_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);

    const insertMember = tx.prepare(`
      INSERT OR IGNORE INTO team_members (id, team_id, hackathon_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Each seeded user belongs to at most 1 team per hackathon by assigning distinct user slices
    for (let t = 1; t <= TOTAL_TEAMS; t++) {
      const teamId = `team_seed_${String(t).padStart(4, '0')}`;
      const hackId = hackathons[(t - 1) % hackathons.length];
      const baseUserIndex = (t - 1) * 4 + 1; // 4 users per team -> 8,000 users assigned, 2,000 free agents
      const leaderId = `usr_seed_${String(baseUserIndex).padStart(5, '0')}`;
      const s1 = SKILLS_POOL[t % SKILLS_POOL.length];
      const s2 = SKILLS_POOL[(t + 3) % SKILLS_POOL.length];
      const s3 = SKILLS_POOL[(t + 7) % SKILLS_POOL.length];
      const maxSize = hackId === 'hack_climate_grid' || hackId === 'hack_bio_compute' ? 5 : 4;
      const memberTarget = 2 + (t % 2); // 2 or 3 members so plenty of open seats exist

      insertTeam.run(
        teamId,
        hackId,
        `Squadron ${t}`,
        `Seeded team ${t} building ${s1} + ${s2} solutions for ${hackId}.`,
        JSON.stringify(Array.from(new Set([s1, s2, s3]))),
        2,
        maxSize,
        leaderId,
        now,
        now,
      );

      for (let m = 0; m < memberTarget; m++) {
        const uid = `usr_seed_${String(baseUserIndex + m).padStart(5, '0')}`;
        insertMember.run(
          `mem_seed_${t}_${m}`,
          teamId,
          hackId,
          uid,
          m === 0 ? 'LEADER' : 'MEMBER',
          new Date(Date.now() - (1000 - m) * 1000).toISOString(),
        );
      }
    }
  });

  const elapsed = Math.round(performance.now() - start);
  console.log(`Bulk seed completed in ${elapsed}ms: 10,000+ users and 2,000+ teams ready.`);
}

runBulkSeed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
