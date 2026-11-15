# REST API Reference

## Authentication (`/api/auth`)
- `POST /api/auth/register` — Register participant account (`201`, returns `{ user, token }`)
- `POST /api/auth/login` — Authenticate with email/password (`200`, sets HttpOnly cookie + returns JWT)
- `POST /api/auth/firebase` — Verify Firebase ID token and issue TeamForge session
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/auth/me` — Get current authenticated participant (`401` if unauthenticated)

## Users (`/api/users`)
- `GET /api/users` — Search/filter participants (`search`, `skill`, `timezone`, `page`, `limit`)
- `GET /api/users/:id` — Fetch public user profile
- `GET /api/users/me/teams` — List authenticated user's active teams
- `GET /api/users/me/invitations` — List pending invitations matching user email
- `PATCH /api/users/me` — Update profile, skills, roles, timezone, availability, links

## Hackathons (`/api/hackathons`)
- `GET /api/hackathons` — List/filter hackathons (`search`, `theme`, `skill`, `openOnly`, `page`, `limit`)
- `GET /api/hackathons/:id` — Get hackathon details and forming teams

## Teams (`/api/teams`)
- `GET /api/teams` — Discovery board (`hackathonId`, `skill`, `hasOpenSeats`, `timezone`, `search`, `page`, `limit`)
- `POST /api/teams` — Create team and set creator as `LEADER` (`201`)
- `GET /api/teams/:id` — Team profile, members, open seats
- `PATCH /api/teams/:id` — Leader-only update (`403` for non-leaders)
- `DELETE /api/teams/:id` — Leader-only team deletion
- `POST /api/teams/:id/join` — Race-proof atomic join (`Idempotency-Key`, returns `201` or `409`)
- `POST /api/teams/:id/leave` — Leave team with deterministic leadership transfer or last-member cleanup
- `GET /api/teams/:id/members` — List team members
- `DELETE /api/teams/:id/members/:userId` — Leader-only member removal
- `POST /api/teams/:id/invitations` — Leader-only rate-limited invite creation (returns raw token once)
- `GET /api/teams/:id/invitations` — Leader-only list of invitations (never exposes hashes/tokens)
- `DELETE /api/teams/:id/invitations/:invitationId` — Leader-only invitation revocation

## Invitations, Join Requests, Matching, Audit, Health
- `POST /api/invitations/:token/accept` — Rate-limited SHA-256 token redemption
- `GET /api/join-requests`, `POST /api/join-requests`, `POST /api/join-requests/:id/accept`, `POST /api/join-requests/:id/reject`
- `GET /api/matching/teammates`, `GET /api/matching/teams` (`wSkills`, `wTimezone`, `wAvailability`)
- `GET /api/audit-logs` (`teamId`, `hackathonId`, `actionType`, `page`, `limit`)
- `GET /api/health` — Database & service health probe
