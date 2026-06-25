import { Player } from '@/types/player';
import { topPoolKey, getGamesGateRange, searchMixedWithGamesGate, searchWithGamesGate } from '@/modules/matchmaking/gamesGate';

function player(id: string, gamesPlayed = 0): Player {
  return {
    id,
    name: id,
    gender: 'male',
    excluded: false,
    checkedIn: true,
    gamesPlayed,
    wins: 0,
    losses: 0,
    career: { gamesPlayed: 0, wins: 0, losses: 0 },
    dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: 3.5 },
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('gamesGate', () => {
  it('builds a stable top-pool key', () => {
    expect(topPoolKey([player('a'), player('b'), player('c')], 2)).toBe('a|b');
  });

  it('skips redundant searches when top-32 unchanged across games buckets', () => {
    const ordered = Array.from({ length: 40 }, (_, i) => player(`p${i}`, i < 10 ? 0 : 1));
    let calls = 0;
    const result = searchWithGamesGate(ordered, 4, 32, (bucket) => {
      calls += 1;
      // Only succeed once the bucket includes a player from the wider games spread.
      return bucket.some((p) => p.gamesPlayed === 1) ? 'ok' : null;
    });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('dedupes mixed gate when both gender top pools are unchanged', () => {
    const males = [player('m0', 0), player('m1', 0), player('m2', 1), player('m3', 1)];
    const females = [player('f0', 0), player('f1', 0), player('f2', 1), player('f3', 1)];
    males.forEach((p) => {
      p.gender = 'male';
    });
    females.forEach((p) => {
      p.gender = 'female';
    });
    let calls = 0;
    const result = searchMixedWithGamesGate(males, females, 8, (maleBucket, femaleBucket) => {
      calls += 1;
      const hasWiderSpread =
        maleBucket.some((p) => p.gamesPlayed === 1) && femaleBucket.some((p) => p.gamesPlayed === 1);
      return hasWiderSpread ? 'ok' : null;
    });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('returns null range for empty pool', () => {
    expect(getGamesGateRange([])).toBeNull();
  });
});
