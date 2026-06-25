import { Player } from '@/types/player';

/** Stable key for the priority-ordered top-N pool — used to skip redundant searches (Smash Syndicate). */
export function topPoolKey(players: Player[], maxCandidates: number): string {
  const limit = Math.min(maxCandidates, players.length);
  if (limit === 0) return '';
  let key = players[0].id;
  for (let i = 1; i < limit; i += 1) {
    key += `|${players[i].id}`;
  }
  return key;
}

export interface GamesGateRange {
  minGames: number;
  maxGames: number;
}

export function getGamesGateRange(players: Player[]): GamesGateRange | null {
  if (players.length === 0) return null;
  return {
    minGames: Math.min(...players.map((player) => player.gamesPlayed)),
    maxGames: Math.max(...players.map((player) => player.gamesPlayed)),
  };
}

/**
 * Fairness-first games gate with deduplication when widening the bucket does not
 * change the priority top-N candidate pool (Smash Syndicate `lastBalancedTopPoolKey`).
 */
export function searchWithGamesGate<T>(
  ordered: Player[],
  minCount: number,
  maxCandidates: number,
  search: (bucket: Player[]) => T | null
): T | null {
  const range = getGamesGateRange(ordered);
  if (!range || ordered.length < minCount) return null;

  let lastTopPoolKey = '';

  for (let allowedMaxGames = range.minGames; allowedMaxGames <= range.maxGames; allowedMaxGames += 1) {
    const bucket = ordered.filter((player) => player.gamesPlayed <= allowedMaxGames);
    if (bucket.length < minCount) continue;

    const key = topPoolKey(bucket, maxCandidates);
    if (key === lastTopPoolKey) continue;
    lastTopPoolKey = key;

    const match = search(bucket);
    if (match) return match;
  }

  return null;
}

/**
 * Mixed doubles gate — dedupe when neither gender's top-N pool changes.
 */
export function searchMixedWithGamesGate<T>(
  males: Player[],
  females: Player[],
  maxCandidatesPerGender: number,
  search: (maleBucket: Player[], femaleBucket: Player[]) => T | null
): T | null {
  const maleRange = getGamesGateRange(males);
  const femaleRange = getGamesGateRange(females);
  if (!maleRange || !femaleRange || males.length < 2 || females.length < 2) return null;

  const minGames = Math.min(maleRange.minGames, femaleRange.minGames);
  const maxGames = Math.max(maleRange.maxGames, femaleRange.maxGames);
  let lastTopPoolKey = '';

  for (let allowedMaxGames = minGames; allowedMaxGames <= maxGames; allowedMaxGames += 1) {
    const maleBucket = males.filter((player) => player.gamesPlayed <= allowedMaxGames);
    const femaleBucket = females.filter((player) => player.gamesPlayed <= allowedMaxGames);
    if (maleBucket.length < 2 || femaleBucket.length < 2) continue;

    const key = `${topPoolKey(maleBucket, maxCandidatesPerGender)}::${topPoolKey(
      femaleBucket,
      maxCandidatesPerGender
    )}`;
    if (key === lastTopPoolKey) continue;
    lastTopPoolKey = key;

    const match = search(maleBucket, femaleBucket);
    if (match) return match;
  }

  return null;
}
