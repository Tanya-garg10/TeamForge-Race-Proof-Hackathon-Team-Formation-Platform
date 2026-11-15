# Deployment Guide (Render + PostgreSQL + Docker)

## 1. Render Deployment (`render.yaml`)
1. Push repository to GitHub.
2. Create a new Blueprint in Render pointing to `render.yaml`.
3. Render automatically provisions:
   - `teamforge-db` (Managed PostgreSQL)
   - `teamforge-web-api` (Node.js service running `npm ci && npm run build` and `npm start` on port `3000` with health check `/api/health`)
4. Configure production environment variables in Render Dashboard:
   - `JWT_SECRET`: Auto-generated 256-bit secret
   - `CORS_ORIGINS`: Production frontend origin URL
   - `POSTGRES_PRISMA_URL`: Injected automatically from `teamforge-db`

## 2. Prisma Migrations (PostgreSQL)
```bash
npx prisma migrate deploy
npm run seed
```

## 3. Local Docker Compose
```bash
docker compose up --build
```
