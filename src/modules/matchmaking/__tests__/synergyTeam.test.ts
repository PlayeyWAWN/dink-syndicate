import { splitTeams } from '@/lib/format-utils';
import {
  applySynergyToManualLineup,
  filterValidTeamSplits,
  getSynergyConfig,
  isQuartetSynergySelectionValid,
  isTeamSplitSynergyValid,
  generateSynergyTeamName,
  getSynergyTeamLabel,
  pairsFullyInQuartet,
  pruneSynergyPairs,
  validateNewSynergyPair,
  wouldBreakSynergy,
} from '@/modules/matchmaking/synergyTeam';
import { createPlayer } from '@/types/player';

function sameTeam(playerIds: string[], a: string, b: string): boolean {
  const { teamA, teamB } = splitTeams(playerIds);
  return (
    (teamA.includes(a) && teamA.includes(b)) ||
    (teamB.includes(a) && teamB.includes(b))
  );
}

describe('synergyTeam', () => {
  const p1 = createPlayer({ id: 'p1', name: 'One', duprDoublesRating: 3.0 });
  const p2 = createPlayer({ id: 'p2', name: 'Two', duprDoublesRating: 3.2 });
  const p3 = createPlayer({ id: 'p3', name: 'Three', duprDoublesRating: 3.8, gender: 'female' });
  const p4 = createPlayer({ id: 'p4', name: 'Four', duprDoublesRating: 4.0, gender: 'female' });

  it('rejects duplicate and invalid mixed pairs', () => {
    const male = createPlayer({ id: 'm1', name: 'M1', gender: 'male' });
    const male2 = createPlayer({ id: 'm2', name: 'M2', gender: 'male' });
    expect(validateNewSynergyPair(male, male2, [], 'mixed_doubles').ok).toBe(false);

    const mixed = validateNewSynergyPair(male, p3, [], 'mixed_doubles');
    expect(mixed.ok).toBe(true);
    if (mixed.ok) {
      expect(mixed.pair).toEqual(['m1', 'p3']);
    }
  });

  it('auto-generates team label when no custom name is set', () => {
    expect(generateSynergyTeamName('Alex', 'Sam')).toBe('Alex & Sam');
    expect(
      getSynergyTeamLabel(['p1', 'p2'], [p1, p2], { 'p1|p2': 'Dream Team' })
    ).toBe('Dream Team');
    expect(getSynergyTeamLabel(['p1', 'p2'], [p1, p2])).toBe('One & Two');
  });

  it('rejects quartets that split an available synergy pair', () => {
    const available = new Set(['p1', 'p2', 'p3', 'p4']);
    expect(
      isQuartetSynergySelectionValid(['p1', 'p3', 'p4', 'p5'], available, [['p1', 'p2']])
    ).toBe(false);
    expect(
      isQuartetSynergySelectionValid(['p1', 'p2', 'p3', 'p4'], available, [['p1', 'p2']])
    ).toBe(true);
    expect(
      isQuartetSynergySelectionValid(['p1', 'p3', 'p4', 'p5'], new Set(['p1', 'p3', 'p4', 'p5']), [
        ['p1', 'p2'],
      ])
    ).toBe(true);
  });

  it('filters team splits to keep pairs together', () => {
    const quartet = [p1, p2, p3, p4];
    const splits: Array<[typeof p1[], typeof p1[]]> = [
      [[p1, p2], [p3, p4]],
      [[p1, p3], [p2, p4]],
      [[p1, p4], [p2, p3]],
    ];
    const active = pairsFullyInQuartet(
      quartet.map((player) => player.id),
      [['p1', 'p2']]
    );
    const valid = filterValidTeamSplits(splits, active);
    expect(valid).toHaveLength(1);
    expect(valid[0]![0].map((player) => player.id)).toEqual(['p1', 'p2']);
  });

  it('reorders manual lineup to honor synergy', () => {
    const config = getSynergyConfig({
      synergyTeamsEnabled: true,
      synergyPairs: [['p1', 'p2']],
    });
    const lineup = applySynergyToManualLineup(
      [p1.id, p3.id, p2.id, p4.id],
      [p1, p2, p3, p4],
      config
    );
    expect(lineup).not.toBeNull();
    expect(sameTeam(lineup!, 'p1', 'p2')).toBe(true);
  });

  it('detects swap that breaks synergy', () => {
    const config = getSynergyConfig({
      synergyTeamsEnabled: true,
      synergyPairs: [['p1', 'p2']],
    });
    const original = [p1.id, p2.id, p3.id, p4.id];
    const swapped = [p1.id, p3.id, p2.id, p4.id];
    expect(wouldBreakSynergy(original, swapped, config)).toBe(true);
    expect(wouldBreakSynergy(original, original, config)).toBe(false);
  });

  it('prunes pairs when a player is removed', () => {
    const pruned = pruneSynergyPairs(
      [
        ['p1', 'p2'],
        ['p3', 'p4'],
      ],
      new Set(['p1', 'p3', 'p4'])
    );
    expect(pruned).toEqual([['p3', 'p4']]);
  });

  it('validates team split helper', () => {
    expect(
      isTeamSplitSynergyValid([p1, p2], [p3, p4], [['p1', 'p2']])
    ).toBe(true);
    expect(
      isTeamSplitSynergyValid([p1, p3], [p2, p4], [['p1', 'p2']])
    ).toBe(false);
  });
});
