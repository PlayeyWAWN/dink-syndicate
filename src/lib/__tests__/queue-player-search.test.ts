import { filterPlayersBySearch } from '@/lib/queue-player-search';
import { createPlayer } from '@/types/player';

describe('filterPlayersBySearch', () => {
  const players = [
    createPlayer({ id: '1', name: 'Nicole' }),
    createPlayer({ id: '2', name: 'Raymond' }),
    createPlayer({ id: '3', name: 'Scarlet' }),
  ];

  it('returns all players when query is empty', () => {
    expect(filterPlayersBySearch(players, '')).toHaveLength(3);
    expect(filterPlayersBySearch(players, '   ')).toHaveLength(3);
  });

  it('filters by partial case-insensitive name match', () => {
    expect(filterPlayersBySearch(players, 'ray').map((p) => p.name)).toEqual(['Raymond']);
    expect(filterPlayersBySearch(players, 'SCAR').map((p) => p.name)).toEqual(['Scarlet']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterPlayersBySearch(players, 'zzz')).toHaveLength(0);
  });
});
