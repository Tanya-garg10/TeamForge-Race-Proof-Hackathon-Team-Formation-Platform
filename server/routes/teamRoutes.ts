import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../errors.ts';
import { requireAuth, type AuthenticatedRequest } from '../auth.ts';
import {
  createInvitationSchema,
  createTeamSchema,
  joinTeamSchema,
  updateTeamSchema,
} from '../../shared/validation.ts';
import {
  createTeamTransactional,
  deleteTeamTransactional,
  getTeamDetails,
  joinTeamTransactional,
  leaveTeamTransactional,
  listTeams,
  removeMemberTransactional,
  updateTeamTransactional,
} from '../services/teamService.ts';
import {
  createInvitationTransactional,
  listTeamInvitations,
  revokeInvitationTransactional,
} from '../services/invitationService.ts';

export const teamRouter = Router();

const inviteCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many invitations created; slow down' } },
});

teamRouter.get('/', (req, res) => {
  const sortParam = req.query.sort;
  const sort =
    sortParam === 'open_seats' || sortParam === 'most_members' ? sortParam : 'newest';
  const result = listTeams({
    hackathonId: typeof req.query.hackathonId === 'string' ? req.query.hackathonId : undefined,
    skill: typeof req.query.skill === 'string' ? req.query.skill : undefined,
    hasOpenSeats: req.query.hasOpenSeats === 'true',
    timezone: typeof req.query.timezone === 'string' ? req.query.timezone : undefined,
    experienceLevel: typeof req.query.experienceLevel === 'string' ? req.query.experienceLevel : undefined,
    maxCapacity: req.query.maxCapacity ? Number(req.query.maxCapacity) : undefined,
    sort,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  });
  res.json(result);
});

teamRouter.post('/', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid team creation data', parsed.error.flatten());
    }
    const team = createTeamTransactional(req.user!, parsed.data);
    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
});

teamRouter.get('/:id', (req, res, next) => {
  try {
    const team = getTeamDetails(req.params.id);
    res.json({ team });
  } catch (err) {
    next(err);
  }
});

teamRouter.patch('/:id', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = updateTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid team update payload', parsed.error.flatten());
    }
    const team = updateTeamTransactional(String(req.params.id), req.user!, parsed.data);
    res.json({ team });
  } catch (err) {
    next(err);
  }
});

teamRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const result = deleteTeamTransactional(String(req.params.id), req.user!);
    res.json({ deleted: true, ...result });
  } catch (err) {
    next(err);
  }
});

teamRouter.post('/:id/join', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = joinTeamSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid join request payload', parsed.error.flatten());
    }
    const headerKey = req.header('Idempotency-Key') || req.header('X-Idempotency-Key');
    const idempotencyKey = headerKey || parsed.data.idempotencyKey;

    const result = joinTeamTransactional({
      teamId: String(req.params.id),
      actor: req.user!,
      idempotencyKey,
    });

    res.status(result.statusCode).json({
      joined: true,
      replayed: result.replayed,
      membershipId: result.membershipId,
      team: result.team,
    });
  } catch (err) {
    next(err);
  }
});

teamRouter.post('/:id/leave', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const result = leaveTeamTransactional(String(req.params.id), req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

teamRouter.get('/:id/members', (req, res, next) => {
  try {
    const team = getTeamDetails(String(req.params.id));
    res.json({ items: team.members ?? [] });
  } catch (err) {
    next(err);
  }
});

teamRouter.delete('/:id/members/:userId', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const team = removeMemberTransactional(String(req.params.id), String(req.params.userId), req.user!);
    res.json({ team });
  } catch (err) {
    next(err);
  }
});

teamRouter.post('/:id/invitations', requireAuth, inviteCreateLimiter, (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = createInvitationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid invitation options', parsed.error.flatten());
    }
    const result = createInvitationTransactional(String(req.params.id), req.user!, parsed.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

teamRouter.get('/:id/invitations', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const items = listTeamInvitations(String(req.params.id), req.user!);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

teamRouter.delete('/:id/invitations/:invitationId', requireAuth, (req: AuthenticatedRequest, res, next) => {
  try {
    const invitation = revokeInvitationTransactional(
      String(req.params.id),
      String(req.params.invitationId),
      req.user!,
    );
    res.json({ invitation });
  } catch (err) {
    next(err);
  }
});
