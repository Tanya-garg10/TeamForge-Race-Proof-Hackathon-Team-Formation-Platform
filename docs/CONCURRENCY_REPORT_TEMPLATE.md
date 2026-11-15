# Concurrency Test Report Template

## Test Environment
- **Date**: YYYY-MM-DD
- **Database Engine**: PostgreSQL 16 (`SELECT ... FOR UPDATE`) / SQLite WAL (`BEGIN IMMEDIATE`)
- **Test Runner**: `vitest run` (`tests/teamforge.integration.test.ts`, Test #11)

## Scenario Configuration
- **Team Capacity (`maxSize`)**: 5
- **Pre-filled Members**: 4 (1 remaining seat)
- **Concurrent Contenders**: 50 distinct registered users with valid JWTs
- **Dispatch Mechanism**: `Promise.all` parallel HTTP `POST /api/teams/:id/join` requests

## Measured Results
- **HTTP 201 Created**: `1`
- **HTTP 409 Conflict**: `49`
- **Final Member Count in DB**: `5`
- **Distinct User Count in Team**: `5` (0 duplicates)
- **Audit Log `TEAM_MEMBER_JOINED` Count**: `1`
- **Idempotency Replay Verification**: Verified (`replayed: true`, zero extra rows)
