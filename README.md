# TeamForge — Race-Proof Hackathon Team Formation Platform

TeamForge is an enterprise-grade, race-condition-proof hackathon team formation and matchmaking platform. Engineered around transactional seat reservations, cryptographically hashed invitations, transparent teammate skill matching, immutable audit logging, and real-time Socket.IO board synchronization.

---

## 🌟 Key Engineering Highlights

1. **Race-Proof Transactional Team Joining**
   - Serializes concurrent membership writes using exclusive write transactions (`BEGIN IMMEDIATE` in SQLite WAL mode / `SELECT ... FOR UPDATE` in PostgreSQL via Prisma).
   - Guarantees zero over-allocation: exactly 1 participant wins the final seat under concurrent load spikes (e.g. 50+ simultaneous requests).
   - Enforces one active team membership per participant per hackathon at the database constraint layer (`UNIQUE(hackathon_id, user_id)`).
   - Full support for `Idempotency-Key` headers so retrying clients safely replay cached responses without duplicating memberships or audit trails.

2. **Secure Cryptographic Invitation System**
   - Generates 32-byte cryptographically random invitation tokens (`crypto.randomBytes(32)`).
   - Stores only `SHA-256` token hashes in the database.
   - Enforces expiration timestamps, `maxUses` quotas, explicit revocations, and IP/token rate-limiting.

3. **Deterministic Leadership Lifecycle**
   - Team creator automatically assumes initial `LEADER` role.
   - If the leader leaves and teammates remain, leadership deterministically transfers to the earliest-joined member (`ORDER BY joined_at ASC, user_id ASC`).
   - If the last member leaves, dependent invitations, join requests, and the team are safely cascaded within an atomic transaction.

4. **Real-Time Post-Commit Synchronization**
   - Socket.IO events (`team:member_joined`, `team:member_left`, `team:leader_changed`, `team:updated`, `team:deleted`, `invitation:created`, `invitation:accepted`, `board:updated`) are dispatched **strictly after** database transaction commits.

5. **Transparent Teammate Matching Algorithm**
   - Configurable weighted score:
     - **60%** Complementary & Required Skills
     - **25%** Timezone Compatibility
     - **15%** Weekly Availability Overlap
   - Normalized `0–100` scores with human-readable breakdowns explaining why a recommendation was made.

6. **Interactive Concurrency Lab**
   - Built-in visual simulation laboratory to test and visualize race conditions and over-allocation prevention in real-time right from the browser.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, Radix UI primitives, Motion.
- **Backend**: Node.js, Express, Socket.IO, TypeScript (`tsx` / `esbuild`).
- **Database & ORM**: SQLite (WAL Mode, `better-sqlite3` compatible) + PostgreSQL (Prisma schema ready for enterprise scaling).
- **Authentication**: JWT authentication with HttpOnly cookies & Bearer tokens, BCrypt password hashing.
- **Testing & Load Testing**: Vitest, Supertest, k6.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm or bun

### 1. Installation

```bash
git clone https://github.com/Tanya-garg10/TeamForge-Race-Proof-Hackathon-Team-Formation-Platform.git
cd TeamForge-Race-Proof-Hackathon-Team-Formation-Platform
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Configure your `.env` variables if needed:
```env
PORT=3000
APP_URL="http://localhost:3000"
JWT_SECRET="your-secure-random-secret-at-least-32-chars"
SQLITE_DB_PATH="./data/teamforge.db"
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👥 Demo Accounts

The local database comes pre-seeded with sample users and teams. All demo accounts use the password:  
**`Password123!`**

| Email | Name | Role / Expertise |
|---|---|---|
| `alice@teamforge.dev` | Alice Chen | Team Leader & Demo Lab Admin |
| `bob@teamforge.dev` | Marcus Vance | Frontend Lead |
| `carol@teamforge.dev` | Priya Nair | ML / AI Engineer |
| `diego@teamforge.dev` | Diego Morales | Full-Stack / DevOps |
| `admin@teamforge.dev` | Nadia Park | Platform Lab Admin |

---

## 🧪 Testing & Verification

```bash
# Type check and code linting
npm run lint

# Run all 22 automated integration and 50-concurrent-request tests
npm test

# Seed 10,000 deterministic users & 2,000 teams for stress testing
npm run seed

# Run k6 load test suite (requires k6 installed)
k6 run load-tests/teamforge.k6.js
```

---

## 🚢 Deployment

### Deploy to Render (Blueprint)
The repository includes a production-ready `render.yaml` blueprint:
1. Fork or push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** > **Blueprint**.
3. Select your repository. Render will automatically spin up:
   - Managed PostgreSQL database (`teamforge-db`)
   - Web API Service (`teamforge-web-api`) with automated health checks (`/api/health`).

### Docker Deployment
Run using Docker Compose:
```bash
docker compose up -d --build
```

For complete deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## 📚 Documentation Index

- 📐 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System, concurrency, and Socket.IO architecture
- 🗄️ [docs/DATABASE.md](docs/DATABASE.md) — Relational schema, constraints, and Prisma/SQLite design
- 🔌 [docs/API.md](docs/API.md) — REST endpoint contracts & status codes
- ⚡ [docs/CONCURRENCY_REPORT_TEMPLATE.md](docs/CONCURRENCY_REPORT_TEMPLATE.md) — 50-request concurrency verification template
- 📊 [docs/K6_REPORT_TEMPLATE.md](docs/K6_REPORT_TEMPLATE.md) — k6 latency/throughput report template
- 🌐 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Render, PostgreSQL, and Docker deployment guide

---

## 📄 License

This project is licensed under the MIT License.
