import { z } from 'zod';

export const UserProfileSchema = z.object({
  uid: z.string(),
  email: z.string(),
  createdAt: z.number().int().nonnegative(),
  lastSeenAt: z.number().int().nonnegative(),
  lastRoute: z.string().default('home'),
  authProvider: z.enum(['google', 'password', 'unknown']).default('unknown'),
  emailVerified: z.boolean().default(false),
  organizerName: z.string().min(1),
  publishEnabled: z.boolean().optional(),
  countedActiveToday: z.string().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const AdminDailyRollupSchema = z.object({
  date: z.string(),
  mainAppPageViews: z.number().int().nonnegative().default(0),
  wallboardPageViews: z.number().int().nonnegative().default(0),
  newSignUps: z.number().int().nonnegative().default(0),
  uniqueActiveUsers: z.number().int().nonnegative().default(0),
  publishSessionsStarted: z.number().int().nonnegative().default(0),
  updatedAt: z.number().int().nonnegative(),
});

export type AdminDailyRollup = z.infer<typeof AdminDailyRollupSchema>;

export const WallboardDailyRollupSchema = z.object({
  date: z.string(),
  totalUniqueViewers: z.number().int().nonnegative().default(0),
  peakConcurrent: z.number().int().nonnegative().default(0),
  totalViewMinutes: z.number().int().nonnegative().default(0),
  sessionsPublished: z.number().int().nonnegative().default(0),
  updatedAt: z.number().int().nonnegative(),
});

export type WallboardDailyRollup = z.infer<typeof WallboardDailyRollupSchema>;
