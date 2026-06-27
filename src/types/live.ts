import { z } from 'zod';

export const GameModeSchema = z.enum(['dupr_open_play', 'win_lose_stack', 'ladder_waterfall']);

export const PublicPlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: z.enum(['male', 'female']).optional(),
  duprDoublesRating: z.number().optional(),
  gamesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});

export type PublicPlayer = z.infer<typeof PublicPlayerSchema>;

export const PublicMatchSchema = z.object({
  id: z.string(),
  courtId: z.string(),
  courtLabel: z.string(),
  playerIds: z.array(z.string()),
  format: z.string(),
  status: z.enum(['active', 'completed']),
  winnerPlayerIds: z.array(z.string()).default([]),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  queuedAt: z.number().optional(),
});

export type PublicMatch = z.infer<typeof PublicMatchSchema>;

export const PublicQueueEntrySchema = z.object({
  position: z.number().int().positive(),
  playerIds: z.array(z.string()),
  label: z.string(),
  queuedAt: z.number().optional(),
  format: z.string().optional(),
});

export type PublicQueueEntry = z.infer<typeof PublicQueueEntrySchema>;

export const PublicRankingRowSchema = z.object({
  rank: z.number().int().positive(),
  playerId: z.string(),
  name: z.string(),
  points: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  duprDoublesRating: z.number().optional(),
  delta: z.enum(['up', 'down', 'same', 'new']).optional(),
});

export type PublicRankingRow = z.infer<typeof PublicRankingRowSchema>;

export const ViewerStatsSchema = z.object({
  totalUnique: z.number().int().nonnegative().default(0),
  peakConcurrent: z.number().int().nonnegative().default(0),
  totalViewMinutes: z.number().int().nonnegative().default(0),
  publishStartedAt: z.number().int().nonnegative(),
});

export type ViewerStats = z.infer<typeof ViewerStatsSchema>;

export const LiveSessionSnapshotSchema = z.object({
  sessionId: z.string(),
  organizerName: z.string(),
  publishToken: z.string(),
  isActive: z.boolean(),
  updatedAt: z.number().int().nonnegative(),
  gameMode: GameModeSchema,
  courts: z.array(z.object({ id: z.string(), label: z.string() })),
  activeMatches: z.array(PublicMatchSchema),
  queueNext: z.array(PublicQueueEntrySchema),
  completedMatches: z.array(PublicMatchSchema),
  rankings: z.array(PublicRankingRowSchema),
  rankingDeltas: z.record(z.enum(['up', 'down', 'same', 'new'])).default({}),
  /** Full roster for wallboard name/skill lookup (not limited to top 10). */
  players: z.array(PublicPlayerSchema).default([]),
  viewerStats: ViewerStatsSchema,
});

export type LiveSessionSnapshot = z.infer<typeof LiveSessionSnapshotSchema>;

export const WallboardViewerPresenceSchema = z.object({
  firstSeen: z.number().int().nonnegative(),
  lastSeen: z.number().int().nonnegative(),
});

export type WallboardViewerPresence = z.infer<typeof WallboardViewerPresenceSchema>;

export const SponsorEntrySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
    logoUrl: z.string().min(1),
    linkUrl: z.string().url().optional(),
  sortOrder: z.number().int().min(0).max(17),
});

export type SponsorEntry = z.infer<typeof SponsorEntrySchema>;

export const SponsorConfigSchema = z.object({
  sponsorsEnabled: z.boolean().default(false),
  sponsors: z.array(SponsorEntrySchema).max(18).default([]),
  updatedAt: z.number().int().nonnegative(),
});

export type SponsorConfig = z.infer<typeof SponsorConfigSchema>;

export const WALLBOARD_MATCH_HISTORY_PAGE_SIZE = 5;

export const ONLINE_USER_THRESHOLD_MS = 2 * 60 * 1000;
export const VIEWER_ACTIVE_THRESHOLD_MS = 60 * 1000;
export const PRESENCE_HEARTBEAT_MS = 30 * 1000;
/** Wallboard is considered abandoned when no snapshot sync for this long. */
export const LIVE_SESSION_STALE_THRESHOLD_MS = 30 * 60 * 1000;
/** While publishing, sync to Firestore on this interval even when the queue is idle. */
export const LIVE_PUBLISH_HEARTBEAT_MS = 2 * 60 * 1000;
