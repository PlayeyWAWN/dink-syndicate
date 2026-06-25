import { partnerSplitPairing, updateLastPartners } from '@/modules/game-mode/partnerSplit';

describe('partnerSplitPairing', () => {
  it('separates last teammates onto opposite teams when possible', () => {
    const lastPartnerByPlayer = { p1: 'p2', p2: 'p1', p3: 'p4', p4: 'p3' };
    const result = partnerSplitPairing(['p1', 'p2', 'p3', 'p4'], lastPartnerByPlayer);

    expect(result.hadPartnerConflict).toBe(false);
    const teamA = result.playerIds.slice(0, 2);
    const teamB = result.playerIds.slice(2, 4);
    expect(teamA.includes('p1') && teamA.includes('p2')).toBe(false);
    expect(teamB.includes('p3') && teamB.includes('p4')).toBe(false);
  });

  it('uses front-of-stack order when no partner history', () => {
    const result = partnerSplitPairing(['p1', 'p2', 'p3', 'p4'], {});
    expect(result.hadPartnerConflict).toBe(false);
    expect(result.playerIds).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
});

describe('updateLastPartners', () => {
  it('records partners for both teams', () => {
    const next = updateLastPartners(['p1', 'p2', 'p3', 'p4'], {});
    expect(next.p1).toBe('p2');
    expect(next.p2).toBe('p1');
    expect(next.p3).toBe('p4');
    expect(next.p4).toBe('p3');
  });
});
