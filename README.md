# TeamForge — Race-Proof Hackathon Team Formation Platform

TeamForge is a full-stack hackathon team formation platform engineered around transactional seat concurrency, cryptographically hashed invitations, transparent teammate skill matching, immutable audit logging, and real-time Socket.IO board synchronization.

## Key Engineering Highlights

1. **Race-Proof Transactional Team Joining**
   - Serializes concurrent writes using exclusive write transactions (`BEGIN IMMEDIATE` in SQLite WAL mode / `SELECT ... FOR UPDATE` in PostgreSQL via `prisma/schema.prisma`).
   - Enforces one active team membership per participant per hackathon at the database constraint layer (`UNIQUE(hackathon_id, user_id)`).
   - Supports `Idempotency-Key` headers so client retries replay cached `201` responses safely without duplicating memberships or audit entries.

2. **Secure Invitation System**
   - Generates 32-byte cryptographically random tokens (`crypto.randomBytes(32)`).
   - Stores only `SHA-256` token hashes (`token_hash`) in the database.
   - Enforces expiration timestamps, `maxUses` caps, revocation, and Express rate limiting.

3. **Deterministic Leadership Lifecycle**
   - Creator becomes initial `LEADER`.
   - When the leader leaves and other members remain, leadership transfers deterministically to the earliest-joined member (`ORDER BY joined_at ASC, user_id ASC`).
   - When the last member leaves, dependent invitations/requests and the team are safely deleted inside a single transaction.

4. **Real-Time Post-Commit Synchronization**
   - Socket.IO events (`team:member_joined`, `team:member_left`, `team:leader_changed`, `team:updated`, `team:deleted`, `invitation:created`, `invitation:accepted`, `board:updated`) are emitted **strictly after** successful database commit.

5. **Transparent Teammate Matching**
   - Configurable weights (default: `60%` complementary skills, `25%` timezone compatibility, `15%` weekly availability overlap), normalized `0–100` per component with human-readable explanations.

## Demo Accounts

All seeded demo accounts use password `Password123!`:
- `alice@teamforge.dev` — Alice Chen (Team Leader & Demo Lab Admin)
- `bob@teamforge.dev` — Marcus Vance (Frontend Lead)
- `carol@teamforge.dev` — Priya Nair (ML Engineer)
- `diego@teamforge.dev` — Diego Morales (Full-Stack / DevOps)
- `admin@teamforge.dev` — Nadia Park (Platform Lab Admin)

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Running Tests & Bulk Seed

```bash
# Type check & Firestore security rules lint
npm run lint

# Run all 22 automated integration & 50-concurrent-request tests
npm test

# Seed 10,000 deterministic users & 2,000 teams
npm run seed

# Run k6 load tests (requires k6 installed)
k6 run load-tests/teamforge.k6.js
```

## Documentation Index

- `docs/ARCHITECTURE.md` — System, concurrency, and Socket.IO architecture
- `docs/DATABASE.md` — Relational schema, constraints, and Prisma/SQLite design
- `docs/API.md` — REST endpoint contracts & status codes
- `docs/CONCURRENCY_REPORT_TEMPLATE.md` — 50-request concurrency verification template
- `docs/K6_REPORT_TEMPLATE.md` — k6 latency/throughput report template
- `docs/DEPLOYMENT.md` — Render + PostgreSQL + Docker deployment guide
