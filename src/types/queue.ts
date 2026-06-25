import { z } from 'zod';
import { MatchStackMetaSchema, WinLoseStackStateSchema } from '@/types/win-lose-stack';

export const QueueEntrySchema = z.object({
  id: z.string().min(1),
  playerIds: z.array(z.string()).min(2).max(4),
  format: z.enum(['doubles', 'mixed_doubles', 'same_gender_doubles', 'singles']).default('doubles'),
  createdAt: z.number().int().nonnegative(),
  /** How this queue entry was created — shown in the queue UI. */
  source: z.enum(['auto', 'manual']).default('auto').optional(),
  /** Player availability timers captured when the entry was queued (restored on remove). */
  availableSinceByPlayer: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

export type QueueEntry = z.infer<typeof QueueEntrySchema>;

export const MatchDuprMetaSchema = z.object({
  duprIdentifier: z.string().optional(),
  duprMatchCode: z.string().optional(),
  duprUploadStatus: z.enum(['pending', 'uploaded', 'failed']).optional(),
  gameScores: z
    .object({
      teamA: z.array(z.number().int().nonnegative()),
      teamB: z.array(z.number().int().nonnegative()),
    })
    .optional(),
});

export type MatchDuprMeta = z.infer<typeof MatchDuprMetaSchema>;

export const MatchSchema = z.object({
  id: z.string().min(1),
  courtId: z.string().nullable().default(null),
  playerIds: z.array(z.string()).min(2).max(4),
  format: z.enum(['doubles', 'mixed_doubles', 'same_gender_doubles', 'singles']).default('doubles'),
  status: z.enum(['queued', 'active', 'completed']).default('queued'),
  winnerPlayerIds: z.array(z.string()).default([]),
  /** When the match was queued (copied from queue entry at court start). */
  queuedAt: z.number().int().nonnegative().optional(),
  /** Copied from queue entry — restored when an active match is cancelled back to queue. */
  source: z.enum(['auto', 'manual']).default('auto').optional(),
  /** Availability snapshot when queued — used for wait analytics. */
  availableSinceByPlayer: z.record(z.string(), z.number().int().nonnegative()).optional(),
  startedAt: z.number().int().nonnegative().optional(),
  completedAt: z.number().int().nonnegative().optional(),
  /** Optional QM note when correcting result, players, or winner after completion. */
  correctionNote: z.string().max(500).optional(),
  /** Unix ms when the match result was last corrected. */
  correctedAt: z.number().int().nonnegative().optional(),
  dupr: MatchDuprMetaSchema.optional(),
  /** Win/Lose Stack mode — tracks which stack fed this match (for cancel routing). */
  stackMeta: MatchStackMetaSchema.optional(),
});

export type Match = z.infer<typeof MatchSchema>;

export const QueueStateSchema = z.object({
  queue: z.array(QueueEntrySchema).default([]),
  activeMatches: z.array(MatchSchema).default([]),
  completedMatches: z.array(MatchSchema).default([]),
  winLoseStack: WinLoseStackStateSchema.optional(),
});

export type QueueState = z.infer<typeof QueueStateSchema>;
