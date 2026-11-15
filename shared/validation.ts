import { z } from 'zod';

export const experienceLevelEnum = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Please enter a valid email address').max(160),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  timezone: z.string().trim().min(1).max(64).default('UTC'),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  preferredRoles: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  weeklyAvailability: z.number().int().min(1).max(168).default(15),
  experienceLevel: experienceLevelEnum.default('INTERMEDIATE'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z
    .string()
    .trim()
    .url('Avatar must be a valid URL')
    .or(z.literal(''))
    .nullable()
    .optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(25).optional(),
  experienceLevel: experienceLevelEnum.optional(),
  preferredRoles: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  weeklyAvailability: z.number().int().min(1).max(168).optional(),
  githubUrl: z
    .string()
    .trim()
    .url('GitHub link must be a valid URL')
    .or(z.literal(''))
    .nullable()
    .optional(),
  portfolioUrl: z
    .string()
    .trim()
    .url('Portfolio link must be a valid URL')
    .or(z.literal(''))
    .nullable()
    .optional(),
});

export const createTeamSchema = z
  .object({
    hackathonId: z.string().trim().min(1, 'Hackathon is required'),
    name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(80),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(1000),
    requiredSkills: z.array(z.string().trim().min(1).max(40)).min(1, 'Select at least one required skill').max(15),
    minSize: z.number().int().min(1).max(10),
    maxSize: z.number().int().min(1).max(10),
  })
  .refine((data) => data.maxSize >= data.minSize, {
    message: 'Maximum size must be greater than or equal to minimum size',
    path: ['maxSize'],
  });

export const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().min(10).max(1000).optional(),
  requiredSkills: z.array(z.string().trim().min(1).max(40)).min(1).max(15).optional(),
  maxSize: z.number().int().min(1).max(10).optional(),
});

export const createInvitationSchema = z.object({
  inviteeEmail: z.string().trim().email().nullable().optional(),
  maxUses: z.number().int().min(1).max(20).default(1),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});

export const createJoinRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  message: z.string().trim().max(400).nullable().optional(),
});

export const joinTeamSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});
