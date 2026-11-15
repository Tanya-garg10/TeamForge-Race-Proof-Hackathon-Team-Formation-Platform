# Database Schema & Constraints

Both the runtime relational store (`server/db.ts`) and the PostgreSQL Prisma schema (`prisma/schema.prisma`) enforce identical relational invariants.

## Core Models

1. **users**: `id`, `email` (unique), `password_hash`, `name`, `skills`, `experience_level`, `preferred_roles`, `timezone`, `weekly_availability`, `github_url`, `portfolio_url`, `is_demo_admin`.
2. **hackathons**: `id`, `name`, `slug` (unique), `theme`, `registration_deadline`, `min_team_size`, `max_team_size`, `required_skills`.
3. **teams**: `id`, `hackathon_id` (FK), `name`, `description`, `required_skills`, `min_size`, `max_size`, `leader_id` (FK), `status` (`ACTIVE | LOCKED | ARCHIVED`). Unique `(hackathon_id, name)`.
4. **team_members**: `id`, `team_id` (FK cascade), `hackathon_id` (FK cascade), `user_id` (FK cascade), `role` (`LEADER | MEMBER`), `joined_at`.
   - **Critical Constraints**: `UNIQUE(team_id, user_id)` and `UNIQUE(hackathon_id, user_id)` prevent duplicate memberships and enforce 1 active team per user per hackathon at the engine level.
5. **invitations**: `id`, `team_id`, `hackathon_id`, `inviter_id`, `invitee_email`, `token_hash` (unique SHA-256 hex), `status`, `max_uses`, `uses_count`, `expires_at`.
6. **join_requests**: `id`, `team_id`, `hackathon_id`, `user_id`, `message`, `status`, `created_at`, `reviewed_at`.
7. **audit_logs**: `id`, `actor_user_id`, `actor_name`, `action_type`, `entity_type`, `entity_id`, `hackathon_id`, `team_id`, `metadata_json`, `created_at`.
8. **idempotency_keys**: `id`, `user_id`, `endpoint`, `idempotency_key`, `status_code`, `response_json`. Unique `(user_id, endpoint, idempotency_key)`.
