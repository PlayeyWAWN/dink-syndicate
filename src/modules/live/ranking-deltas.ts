import { PublicRankingRow } from '@/types/live';

export type RankingDelta = 'up' | 'down' | 'same' | 'new';

/** Compare current top-10 order to previous snapshot and compute movement badges. */
export function computeRankingDeltas(
  current: PublicRankingRow[],
  previous: PublicRankingRow[] | null | undefined
): Record<string, RankingDelta> {
  const deltas: Record<string, RankingDelta> = {};
  if (!previous || previous.length === 0) {
    for (const row of current) {
      deltas[row.playerId] = 'new';
    }
    return deltas;
  }

  const prevRankByPlayer = new Map(previous.map((row) => [row.playerId, row.rank]));

  for (const row of current) {
    const prevRank = prevRankByPlayer.get(row.playerId);
    if (prevRank == null) {
      deltas[row.playerId] = 'new';
    } else if (row.rank < prevRank) {
      deltas[row.playerId] = 'up';
    } else if (row.rank > prevRank) {
      deltas[row.playerId] = 'down';
    } else {
      deltas[row.playerId] = 'same';
    }
  }

  return deltas;
}
