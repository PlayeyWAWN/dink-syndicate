import { splitTeams } from '@/lib/format-utils';
import { buildManualMatch, sortAvailableByLongestWait, validateEntryGenderRules } from '@/modules/queue/ManualMatchService';
import { createPlayer } from '@/types/player';

describe('ManualMatchService', () => {
  it('builds ordered mixed doubles from four players', () => {
    const players = [
      createPlayer({ id: 'm1', name: 'M1', gender: 'male', duprDoublesRating: 5 }),
      createPlayer({ id: 'm2', name: 'M2', gender: 'male', duprDoublesRating: 3.5 }),
      createPlayer({ id: 'f1', name: 'F1', gender: 'female', duprDoublesRating: 5 }),
      createPlayer({ id: 'f2', name: 'F2', gender: 'female', duprDoublesRating: 3.5 }),
    ];
    const result = buildManualMatch('doubles', 'mixed_doubles', players);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.playerIds).toHaveLength(4);
    expect(validateEntryGenderRules(result.format, result.playerIds, players)).toBe(true);
  });

  it('rejects mixed doubles without two of each gender', () => {
    const players = Array.from({ length: 4 }, (_, index) =>
      createPlayer({ id: `p${index}`, name: `P${index}`, gender: 'male' })
    );
    const result = buildManualMatch('doubles', 'mixed_doubles', players);
    expect(result.ok).toBe(false);
  });

  it('validates same-gender teams after a cross-team swap', () => {
    const players = [
      createPlayer({ id: 'a1', name: 'A1', gender: 'male', duprDoublesRating: 4 }),
      createPlayer({ id: 'a2', name: 'A2', gender: 'male', duprDoublesRating: 3.5 }),
      createPlayer({ id: 'b1', name: 'B1', gender: 'male', duprDoublesRating: 4 }),
      createPlayer({ id: 'b2', name: 'B2', gender: 'male', duprDoublesRating: 3.5 }),
    ];
    const swapped = ['b1', 'b2', 'a1', 'a2'];
    expect(validateEntryGenderRules('same_gender_doubles', swapped, players)).toBe(true);
  });

  it('keeps synergy pair partnered in manual doubles build', () => {
    const players = [
      createPlayer({ id: 'a', name: 'A', duprDoublesRating: 4 }),
      createPlayer({ id: 'b', name: 'B', duprDoublesRating: 2 }),
      createPlayer({ id: 'c', name: 'C', duprDoublesRating: 4 }),
      createPlayer({ id: 'd', name: 'D', duprDoublesRating: 2 }),
    ];
    const result = buildManualMatch('doubles', 'balanced', players, {
      synergyTeamsEnabled: true,
      synergyPairs: [['a', 'b']],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { teamA, teamB } = splitTeams(result.playerIds);
    expect(
      (teamA.includes('a') && teamA.includes('b')) ||
        (teamB.includes('a') && teamB.includes('b'))
    ).toBe(true);
  });

  it('sorts standby players by longest wait first', () => {
    const now = Date.now();
    const players = [
      { ...createPlayer({ id: 'recent', name: 'Recent' }), availableSince: now - 60_000 },
      { ...createPlayer({ id: 'long', name: 'Long' }), availableSince: now - 900_000 },
      { ...createPlayer({ id: 'mid', name: 'Mid' }), availableSince: now - 300_000 },
    ];
    const sorted = sortAvailableByLongestWait(players);
    expect(sorted.map((player) => player.id)).toEqual(['long', 'mid', 'recent']);
  });
});
