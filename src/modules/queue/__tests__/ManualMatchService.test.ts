import { splitTeams } from '@/lib/format-utils';
import {
  buildManualMatch,
  getStackReplaceCandidates,
  sortAvailableByLongestWait,
  validateEntryGenderRules,
} from '@/modules/queue/ManualMatchService';
import { createPlayer } from '@/types/player';
import { emptyWinLoseStackState } from '@/types/win-lose-stack';
import { Match, QueueState } from '@/types/queue';

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

  it('includes stack waiters and standby in the stack replace pool, not on-court players', () => {
    const onCourt = createPlayer({ id: 'on1', name: 'On Court' });
    const partner = createPlayer({ id: 'on2', name: 'Partner' });
    const opp1 = createPlayer({ id: 'on3', name: 'Opp1' });
    const opp2 = createPlayer({ id: 'on4', name: 'Opp2' });
    const waiter = createPlayer({ id: 'wait1', name: 'Waiter' });
    const standby = createPlayer({ id: 'standby', name: 'Standby', checkedIn: false });
    const otherCourt = createPlayer({ id: 'other', name: 'Other Court' });

    const match: Match = {
      id: 'm1',
      courtId: 'c1',
      playerIds: [onCourt.id, partner.id, opp1.id, opp2.id],
      format: 'doubles',
      status: 'active',
      winnerPlayerIds: [],
      source: 'auto',
      startedAt: Date.now(),
      stackMeta: { sourceStack: 'winners', stackPullOrder: [onCourt.id, partner.id, opp1.id, opp2.id] },
    };

    const queueState: QueueState = {
      queue: [],
      activeMatches: [
        match,
        {
          ...match,
          id: 'm2',
          courtId: 'c2',
          playerIds: [otherCourt.id, 'x2', 'x3', 'x4'],
        },
      ],
      completedMatches: [],
      winLoseStack: {
        ...emptyWinLoseStackState(),
        winnerStack: [waiter.id],
      },
    };

    const pool = getStackReplaceCandidates(
      [onCourt, partner, opp1, opp2, waiter, standby, otherCourt],
      queueState,
      match,
      onCourt
    );
    const ids = pool.map((player) => player.id);
    expect(ids).toContain(waiter.id);
    expect(ids).toContain(standby.id);
    expect(ids).not.toContain(onCourt.id);
    expect(ids).not.toContain(otherCourt.id);
    expect(ids).not.toContain(partner.id);
  });
});
