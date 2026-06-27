import { computeRankingDeltas } from '@/modules/live/ranking-deltas';
import { PublicRankingRow } from '@/types/live';

const rows = (ids: string[]): PublicRankingRow[] =>
  ids.map((id, index) => ({
    rank: index + 1,
    playerId: id,
    name: id,
    points: 10 - index,
    wins: 1,
    losses: 0,
    gamesPlayed: 1,
  }));

describe('computeRankingDeltas', () => {
  it('marks all as new when no previous snapshot', () => {
    const deltas = computeRankingDeltas(rows(['a', 'b']), null);
    expect(deltas.a).toBe('new');
    expect(deltas.b).toBe('new');
  });

  it('detects up and down movement', () => {
    const previous = rows(['a', 'b', 'c']);
    const current = rows(['b', 'a', 'c']);
    const deltas = computeRankingDeltas(current, previous);
    expect(deltas.b).toBe('up');
    expect(deltas.a).toBe('down');
    expect(deltas.c).toBe('same');
  });
});
