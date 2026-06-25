import { winnerIdsForTeam, splitTeams, winRate, clampDuprRating, formatDuprRating } from '@/lib/format-utils';

describe('format-utils', () => {
  it('splits teams evenly', () => {
    expect(splitTeams(['a', 'b', 'c', 'd'])).toEqual({
      teamA: ['a', 'b'],
      teamB: ['c', 'd'],
    });
  });

  it('returns winner ids for team', () => {
    expect(winnerIdsForTeam(['a', 'b', 'c', 'd'], 'B')).toEqual(['c', 'd']);
  });

  it('formats win rate', () => {
    expect(winRate(2, 4)).toBe('50%');
    expect(winRate(0, 0)).toBe('—');
  });

  it('clamps and formats dupr ratings to 2 decimals', () => {
    expect(clampDuprRating(3.456)).toBe(3.46);
    expect(formatDuprRating(2)).toBe('2.00');
    expect(formatDuprRating(3.5)).toBe('3.50');
  });
});
