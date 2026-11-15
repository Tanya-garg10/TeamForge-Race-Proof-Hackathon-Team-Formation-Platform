import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getDb, initDatabase } from './db.ts';
import { seedInitialDataIfEmpty } from './seedDemo.ts';
import { AppError } from './errors.ts';
import { authRouter } from './routes/authRoutes.ts';
import { userRouter } from './routes/userRoutes.ts';
import { hackathonRouter } from './routes/hackathonRoutes.ts';
import { teamRouter } from './routes/teamRoutes.ts';
import {
  adminRouter,
  auditRouter,
  invitationRouter,
  joinRequestRouter,
  matchingRouter,
} from './routes/extraRoutes.ts';

export function createApp(options?: { dbPath?: string; skipSeed?: boolean }) {
  initDatabase(options?.dbPath);
  if (!options?.skipSeed) {
    seedInitialDataIfEmpty();
  }

  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : true;

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    try {
      const db = getDb();
      const row = db.prepare('SELECT 1 AS ok').get() as { ok: number };
      res.json({
        status: row?.ok === 1 ? 'ok' : 'degraded',
        service: 'teamforge-api',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch (err) {
      res.status(503).json({
        status: 'unhealthy',
        error: err instanceof Error ? err.message : 'Database unreachable',
      });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/hackathons', hackathonRouter);
  app.use('/api/teams', teamRouter);
  app.use('/api/invitations', invitationRouter);
  app.use('/api/join-requests', joinRequestRouter);
  app.use('/api/matching', matchingRouter);
  app.use('/api/audit-logs', auditRouter);
  app.use('/api/admin', adminRouter);

  // Unknown API routes return 404 JSON instead of falling through to SPA HTML
  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'ROUTE_NOT_FOUND', 'API endpoint not found'));
  });

  // Centralized error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      });
      return;
    }

    console.error('Unhandled server error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred',
      },
    });
  });

  return app;
}
