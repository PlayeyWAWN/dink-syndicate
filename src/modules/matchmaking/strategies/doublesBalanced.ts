import { QueueEntry } from '@/types/queue';
import { Player } from '@/types/player';
import { createId } from '@/modules/matchmaking/create-id';
import { findBestBalancedDoublesMatch } from '@/modules/matchmaking/DuprBalance';
import { FairnessRanker } from '@/modules/matchmaking/FairnessRanker';
import { MatchmakingContext } from '@/modules/matchmaking/types';

/** Combinatorial DUPR-balanced doubles (replaces first-4 + 1+4 vs 2+3 heuristic). */
export function buildDoublesBalancedMatch(
  available: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker
): QueueEntry | null {
  const match = findBestBalancedDoublesMatch(available, context, ranker);
  if (!match) return null;

  return {
    id: createId('queue'),
    playerIds: [...match.teamA, ...match.teamB],
    format: 'doubles',
    createdAt: Date.now(),
  };
}
