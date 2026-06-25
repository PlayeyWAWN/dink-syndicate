import { MATCHMAKING_LIMITS } from '@/config/matchmaking';
import { QueueEntry } from '@/types/queue';
import { Player } from '@/types/player';
import { createId } from '@/modules/matchmaking/create-id';
import { findBestBalancedQuartetWithGamesGate } from '@/modules/matchmaking/DuprBalance';
import { FairnessRanker } from '@/modules/matchmaking/FairnessRanker';
import { MatchmakingContext } from '@/modules/matchmaking/types';

function findBestSameGenderMatchInPool(
  pool: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker
) {
  return findBestBalancedQuartetWithGamesGate(
    pool,
    context,
    ranker,
    MATCHMAKING_LIMITS.maxSameGenderCandidates
  );
}

/** All-male (MM vs MM) or all-female (FF vs FF), skill-balanced quartets. */
export function buildSameGenderDoublesMatch(
  available: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker
): QueueEntry | null {
  const males = available.filter((player) => player.gender === 'male');
  const females = available.filter((player) => player.gender === 'female');

  const maleMatch = findBestSameGenderMatchInPool(males, context, ranker);
  const femaleMatch = findBestSameGenderMatchInPool(females, context, ranker);

  let chosen = maleMatch;
  if (maleMatch && femaleMatch) {
    chosen = maleMatch.score <= femaleMatch.score ? maleMatch : femaleMatch;
  } else if (femaleMatch) {
    chosen = femaleMatch;
  }

  if (!chosen) return null;

  return {
    id: createId('queue'),
    playerIds: [...chosen.teamA, ...chosen.teamB],
    format: 'same_gender_doubles',
    createdAt: Date.now(),
  };
}
