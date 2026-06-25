import { QueueEntry } from '@/types/queue';
import { Player } from '@/types/player';
import { createId } from '@/modules/matchmaking/create-id';
import { findBestBalancedMixedDoublesMatch } from '@/modules/matchmaking/DuprBalance';
import { FairnessRanker } from '@/modules/matchmaking/FairnessRanker';
import { MatchmakingContext } from '@/modules/matchmaking/types';

/** Mixed doubles: fairness-first top-2 per gender (Smash Mix), bounded DUPR fallback. */
export function buildMixedDoublesMatch(
  available: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker
): QueueEntry | null {
  const match = findBestBalancedMixedDoublesMatch(available, context, ranker);
  if (!match) return null;

  return {
    id: createId('queue'),
    playerIds: [...match.teamA, ...match.teamB],
    format: 'mixed_doubles',
    createdAt: Date.now(),
  };
}
