import { z } from 'zod';

export const SessionPlayerStatsSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  gamesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});

export type SessionPlayerStats = z.infer<typeof SessionPlayerStatsSchema>;

export const SessionArchiveSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative(),
  matchesCompleted: z.number().int().nonnegative().default(0),
  playerStats: z.array(SessionPlayerStatsSchema).default([]),
});

export type SessionArchive = z.infer<typeof SessionArchiveSchema>;

export function defaultArchiveName(date = new Date()): string {
  const label = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${label} Open Play`;
}
