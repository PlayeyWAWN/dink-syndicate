import { z } from 'zod';

export const WinLoseStackStateSchema = z.object({
  winnerStack: z.array(z.string()).default([]),
  loserStack: z.array(z.string()).default([]),
  nextUp: z.enum(['winners', 'losers']).default('winners'),
  lastPartnerByPlayer: z.record(z.string(), z.string()).default({}),
});

export type WinLoseStackState = z.infer<typeof WinLoseStackStateSchema>;

export const MatchStackMetaSchema = z.object({
  sourceStack: z.enum(['winners', 'losers']),
  /** Player IDs in the order they were pulled from the stack front. */
  stackPullOrder: z.array(z.string()).min(2).max(4),
});

export type MatchStackMeta = z.infer<typeof MatchStackMetaSchema>;

export function emptyWinLoseStackState(): WinLoseStackState {
  return {
    winnerStack: [],
    loserStack: [],
    nextUp: 'winners',
    lastPartnerByPlayer: {},
  };
}

export function ensureWinLoseStackState(
  stack: WinLoseStackState | undefined
): WinLoseStackState {
  return stack ?? emptyWinLoseStackState();
}
