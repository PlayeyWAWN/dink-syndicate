import { z } from 'zod';

export const LadderWaterfallStateSchema = z.object({
  benchByCourtId: z.record(z.string(), z.array(z.string())).default({}),
  waitingPool: z.array(z.string()).default([]),
  lastPartnerByPlayer: z.record(z.string(), z.string()).default({}),
});

export type LadderWaterfallState = z.infer<typeof LadderWaterfallStateSchema>;

export const MatchLadderMetaSchema = z.object({
  courtId: z.string().min(1),
  /** Court rank at match start (0 = Court 1 = top rung). */
  courtRank: z.number().int().nonnegative(),
  /** Player IDs in the order they were pulled from the bench. */
  benchPullOrder: z.array(z.string()).min(2).max(4),
});

export type MatchLadderMeta = z.infer<typeof MatchLadderMetaSchema>;

export function emptyLadderWaterfallState(): LadderWaterfallState {
  return {
    benchByCourtId: {},
    waitingPool: [],
    lastPartnerByPlayer: {},
  };
}

export function ensureLadderWaterfallState(
  state: LadderWaterfallState | undefined
): LadderWaterfallState {
  return state ?? emptyLadderWaterfallState();
}
