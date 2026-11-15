# Architecture Overview

## System Topology

- **Frontend (`src/`)**: React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui (Radix Primitives), React Router v7, TanStack Query, React Hook Form + Zod, Socket.IO Client.
- **Backend (`server.ts`, `server/`)**: Node.js, Express, TypeScript, Socket.IO, JWT + bcryptjs, express-rate-limit, transactional relational storage (`node:sqlite` WAL mode in runtime/tests + `prisma/schema.prisma` for PostgreSQL deployments).
- **Shared Core (`shared/`)**: Zod validation schemas, domain DTO types, and transparent weighted teammate matching engine (`shared/matching.ts`).

## Concurrency Control Flow (`POST /api/teams/:id/join`)

```
Client Request (Authorization + Idempotency-Key)
  │
  ▼
withTransaction (BEGIN IMMEDIATE / SELECT ... FOR UPDATE)
  ├─ 1. Lookup (user_id, endpoint, idempotency_key) -> return cached 201 if present
  ├─ 2. Fetch target team & hackathon deadline -> 404 / 409 if inactive/closed
  ├─ 3. Check existing membership in hackathon -> 409 if already on a team
  ├─ 4. Count current members -> 409 if count >= max_size
  ├─ 5. INSERT team_members (enforced by UNIQUE(hackathon_id, user_id))
  ├─ 6. INSERT audit_logs
  └─ 7. INSERT idempotency_keys -> COMMIT
  │
  ▼ (Only after COMMIT succeeds)
Socket.IO Broadcast: team:member_joined + board:updated
```

## Real-Time Room Model

- `board`: Global team discovery updates
- `hackathon:<hackathonId>`: Hackathon-scoped board updates
- `team:<teamId>`: Team-specific roster, leadership, and invitation events
- `user:<userId>`: Authenticated user channel
