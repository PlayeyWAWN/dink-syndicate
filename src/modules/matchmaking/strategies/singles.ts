import { QueueEntry } from '@/types/queue';
import { Player } from '@/types/player';
import { MATCHMAKING_LIMITS } from '@/config/matchmaking';
import { createId } from '@/modules/matchmaking/create-id';
import { findBestBalancedSinglesPair } from '@/modules/matchmaking/DuprBalance';
import { FairnessRanker } from '@/modules/matchmaking/FairnessRanker';
import { searchWithGamesGate } from '@/modules/matchmaking/gamesGate';
import { MatchmakingContext } from '@/modules/matchmaking/types';

/** Skill-balanced 1v1 with games-first fairness gate. */
export function buildSinglesMatch(
  available: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker
): QueueEntry | null {
  const prioritized = ranker.sortBySinglesFairness(available, context);
  if (prioritized.length < 2) return null;

  const pair = searchWithGamesGate(
    prioritized,
    2,
    MATCHMAKING_LIMITS.maxSinglesCandidates,
    (candidates) => findBestBalancedSinglesPair(candidates, context, ranker)
  );

  if (!pair) return null;

  return {
    id: createId('queue'),
    playerIds: [pair.playerA, pair.playerB],
    format: 'singles',
    createdAt: Date.now(),
  };
}
