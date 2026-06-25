import { z } from 'zod';
import { DEFAULT_DUPR_RATING } from '@/config/constants';

export const PlayerDuprProfileSchema = z.object({
  duprId: z.string().optional(),
  duprDoublesRating: z.number().min(0).max(8).optional(),
  duprSinglesRating: z.number().min(0).max(8).optional(),
  duprConnected: z.boolean().default(false),
  duprLastSyncedAt: z.number().int().nonnegative().optional(),
  duprRatingSource: z.enum(['manual', 'dupr_sso', 'dupr_webhook']).default('manual'),
});

export type PlayerDuprProfile = z.infer<typeof PlayerDuprProfileSchema>;

export const PlayerGenderSchema = z.enum(['male', 'female']);
export type PlayerGender = z.infer<typeof PlayerGenderSchema>;

export const PlayerStatsSchema = z.object({
  gamesPlayed: z.number().int().nonnegative().default(0),
  wins: z.number().int().nonnegative().default(0),
  losses: z.number().int().nonnegative().default(0),
});

export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
export type StatsView = 'session' | 'career';

export const EMPTY_PLAYER_STATS: PlayerStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
};

export const PlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  gender: PlayerGenderSchema.default('male'),
  excluded: z.boolean().default(false),
  checkedIn: z.boolean().default(false),
  /** Unix ms when the player last checked in (for arrival penalty). */
  checkedInAt: z.number().int().nonnegative().optional(),
  /** Unix ms when the player last entered the available pool (not queued/on court). */
  availableSince: z.number().int().nonnegative().optional(),
  /** Unix ms — player is on break until this time (checked in, not matchable). */
  pausedUntil: z.number().int().nonnegative().optional(),
  /** Current session counters — reset when a new session starts. */
  gamesPlayed: z.number().int().nonnegative().default(0),
  wins: z.number().int().nonnegative().default(0),
  losses: z.number().int().nonnegative().default(0),
  /** Lifetime totals across all archived and active sessions. */
  career: PlayerStatsSchema.default(EMPTY_PLAYER_STATS),
  dupr: PlayerDuprProfileSchema.default({
    duprConnected: false,
    duprRatingSource: 'manual',
    duprDoublesRating: DEFAULT_DUPR_RATING,
  }),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type Player = z.infer<typeof PlayerSchema>;

export function createPlayer(input: {
  id: string;
  name: string;
  gender?: PlayerGender;
  duprDoublesRating?: number;
  /** Test/fixture override — production adds use default false. */
  checkedIn?: boolean;
}): Player {
  const now = Date.now();
  const checkedIn = input.checkedIn ?? false;
  return PlayerSchema.parse({
    id: input.id,
    name: input.name.trim(),
    gender: input.gender ?? 'male',
    excluded: false,
    checkedIn,
    checkedInAt: checkedIn ? now : undefined,
    availableSince: checkedIn ? now : undefined,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    career: { ...EMPTY_PLAYER_STATS },
    dupr: {
      duprConnected: false,
      duprRatingSource: 'manual',
      duprDoublesRating: input.duprDoublesRating ?? DEFAULT_DUPR_RATING,
    },
    createdAt: now,
    updatedAt: now,
  });
}

/** True when the player is on a timed break from matchmaking. */
export function isPlayerPaused(player: Player, now = Date.now()): boolean {
  return player.pausedUntil != null && player.pausedUntil > now;
}

/** True when the player can enter the available match pool. */
export function isPlayerMatchable(player: Player, now = Date.now()): boolean {
  return player.checkedIn && !player.excluded && !isPlayerPaused(player, now);
}

export function getPlayerSessionStats(player: Player): PlayerStats {
  return {
    gamesPlayed: player.gamesPlayed,
    wins: player.wins,
    losses: player.losses,
  };
}

export function getPlayerStatsForView(player: Player, view: StatsView): PlayerStats {
  return view === 'career' ? player.career : getPlayerSessionStats(player);
}
