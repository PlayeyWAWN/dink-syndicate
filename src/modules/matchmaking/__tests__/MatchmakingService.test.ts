import { splitTeams } from '@/lib/format-utils';
import { MatchmakingService } from '@/modules/matchmaking/MatchmakingService';
import { FairnessRanker } from '@/modules/matchmaking/FairnessRanker';
import { balanceDoublesTeamsBySplit } from '@/modules/matchmaking/DuprBalance';
import { buildDoublesBalancedMatch } from '@/modules/matchmaking/strategies/doublesBalanced';
import { createPlayer, Player } from '@/types/player';
import { QueueState } from '@/types/queue';

const emptyState: QueueState = { queue: [], activeMatches: [], completedMatches: [] };

function pool(players: Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    checkedIn: true,
    checkedInAt: player.checkedInAt ?? Date.now(),
    availableSince: player.availableSince ?? Date.now(),
  }));
}

function withSinglesRating(player: Player, rating: number): Player {
  return {
    ...player,
    dupr: {
      ...player.dupr,
      duprSinglesRating: rating,
      duprDoublesRating: rating,
    },
  };
}

function withDoublesRating(player: Player, rating: number): Player {
  return {
    ...player,
    dupr: { ...player.dupr, duprDoublesRating: rating },
  };
}

function withCheckIn(player: Player, checkedInAt: number): Player {
  return {
    ...player,
    checkedIn: true,
    checkedInAt,
    availableSince: checkedInAt,
  };
}

describe('MatchmakingService', () => {
  const service = new MatchmakingService();
  const ranker = new FairnessRanker();
  const sessionStart = Date.now();

  it('sorts by games played then rating', () => {
    const players = [
      createPlayer({ id: 'a', name: 'A', duprDoublesRating: 4 }),
      createPlayer({ id: 'b', name: 'B', duprDoublesRating: 3 }),
    ];
    players[0].gamesPlayed = 2;
    const context = ranker.createContext();
    const sorted = ranker.sortByFairness(players, context);
    expect(sorted[0].id).toBe('b');
  });

  it('builds doubles match when 4+ available', () => {
    const players = Array.from({ length: 4 }, (_, i) =>
      createPlayer({ id: `p${i}`, name: `P${i}` })
    );
    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'balanced',
      players: pool(players),
      queueState: emptyState,
    });
    expect(entry?.playerIds).toHaveLength(4);
    expect(entry?.format).toBe('doubles');
  });

  it('balances doubles teams by rating split helper', () => {
    const players = [
      createPlayer({ id: '1', name: 'A', duprDoublesRating: 4 }),
      createPlayer({ id: '2', name: 'B', duprDoublesRating: 3.5 }),
      createPlayer({ id: '3', name: 'C', duprDoublesRating: 3 }),
      createPlayer({ id: '4', name: 'D', duprDoublesRating: 2.5 }),
    ];
    const ids = balanceDoublesTeamsBySplit(players);
    expect(ids).toHaveLength(4);
  });

  it('builds mixed doubles with gender-balanced teams', () => {
    const players = [
      createPlayer({ id: 'm1', name: 'M1', gender: 'male', duprDoublesRating: 4 }),
      createPlayer({ id: 'm2', name: 'M2', gender: 'male', duprDoublesRating: 3 }),
      createPlayer({ id: 'f1', name: 'F1', gender: 'female', duprDoublesRating: 3.5 }),
      createPlayer({ id: 'f2', name: 'F2', gender: 'female', duprDoublesRating: 2.5 }),
    ];
    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'mixed_doubles',
      players: pool(players),
      queueState: emptyState,
    });
    expect(entry?.format).toBe('mixed_doubles');
    expect(entry?.playerIds).toHaveLength(4);
  });

  it('rejects unbalanced mixed doubles when only four players include a beginner outlier', () => {
    const players = [
      withDoublesRating(createPlayer({ id: 'pj', name: 'PJ', gender: 'male' }), 2.5),
      withDoublesRating(createPlayer({ id: 'jesse', name: 'Jesse', gender: 'male' }), 5.0),
      withDoublesRating(createPlayer({ id: 'carmen', name: 'Carmen', gender: 'female' }), 5.0),
      withDoublesRating(createPlayer({ id: 'epay', name: 'Epay', gender: 'female' }), 5.0),
    ];
    players.forEach((player) => {
      player.gamesPlayed = 1;
    });

    expect(
      service.buildMatch({
        courtFormat: 'doubles',
        matchMode: 'mixed_doubles',
        players: pool(players),
        queueState: emptyState,
      })
    ).toBeNull();
  });

  it('prefers a balanced mixed quartet over pairing a beginner with two experts', () => {
    const players = [
      withDoublesRating(createPlayer({ id: 'pj', name: 'PJ', gender: 'male' }), 2.5),
      withDoublesRating(createPlayer({ id: 'jesse', name: 'Jesse', gender: 'male' }), 5.0),
      withDoublesRating(createPlayer({ id: 'mike', name: 'Mike', gender: 'male' }), 3.5),
      withDoublesRating(createPlayer({ id: 'carmen', name: 'Carmen', gender: 'female' }), 5.0),
      withDoublesRating(createPlayer({ id: 'epay', name: 'Epay', gender: 'female' }), 5.0),
      withDoublesRating(createPlayer({ id: 'sara', name: 'Sara', gender: 'female' }), 3.5),
    ];
    players.forEach((player) => {
      player.gamesPlayed = 1;
    });

    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'mixed_doubles',
      players: pool(players),
      queueState: emptyState,
    });

    expect(entry?.playerIds).toHaveLength(4);
    expect(entry?.playerIds).not.toContain('pj');
  });

  it('returns null for mixed doubles without enough of each gender', () => {
    const players = [
      createPlayer({ id: 'm1', name: 'M1', gender: 'male' }),
      createPlayer({ id: 'm2', name: 'M2', gender: 'male' }),
      createPlayer({ id: 'f1', name: 'F1', gender: 'female' }),
    ];
    expect(
      service.buildMatch({
        courtFormat: 'doubles',
        matchMode: 'mixed_doubles',
        players: pool(players),
        queueState: emptyState,
      })
    ).toBeNull();
  });

  it('builds same-gender balanced match for four males', () => {
    const players = [
      createPlayer({ id: 'm1', name: 'M1', gender: 'male', duprDoublesRating: 4 }),
      createPlayer({ id: 'm2', name: 'M2', gender: 'male', duprDoublesRating: 3.8 }),
      createPlayer({ id: 'm3', name: 'M3', gender: 'male', duprDoublesRating: 3.6 }),
      createPlayer({ id: 'm4', name: 'M4', gender: 'male', duprDoublesRating: 3.4 }),
    ];
    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'same_gender',
      players: pool(players),
      queueState: emptyState,
    });
    expect(entry?.format).toBe('same_gender_doubles');
    expect(entry?.playerIds).toHaveLength(4);
    const selected = entry!.playerIds.map((id) => players.find((p) => p.id === id)!);
    expect(selected.every((p) => p.gender === 'male')).toBe(true);
  });

  it('returns null for same-gender mode without four of one gender', () => {
    const players = [
      createPlayer({ id: 'm1', name: 'M1', gender: 'male' }),
      createPlayer({ id: 'm2', name: 'M2', gender: 'male' }),
      createPlayer({ id: 'm3', name: 'M3', gender: 'male' }),
      createPlayer({ id: 'f1', name: 'F1', gender: 'female' }),
    ];
    expect(
      service.buildMatch({
        courtFormat: 'doubles',
        matchMode: 'same_gender',
        players: pool(players),
        queueState: emptyState,
      })
    ).toBeNull();
  });

  it('builds skill-balanced singles match by rating proximity', () => {
    const players = [
      withSinglesRating(createPlayer({ id: 'a', name: 'A' }), 3.0),
      withSinglesRating(createPlayer({ id: 'b', name: 'B' }), 3.2),
      withSinglesRating(createPlayer({ id: 'c', name: 'C' }), 5.5),
    ];
    const entry = service.buildMatch({
      courtFormat: 'singles',
      matchMode: 'balanced',
      players: pool(players),
      queueState: emptyState,
    });
    expect(entry?.format).toBe('singles');
    expect(entry?.playerIds).toEqual(expect.arrayContaining(['a', 'b']));
    expect(entry?.playerIds).not.toContain('c');
  });

  it('returns null for singles when no balanced pair exists', () => {
    const players = [
      withSinglesRating(createPlayer({ id: 'a', name: 'A' }), 2.0),
      withSinglesRating(createPlayer({ id: 'b', name: 'B' }), 5.0),
    ];
    expect(
      service.buildMatch({
        courtFormat: 'singles',
        matchMode: 'balanced',
        players: pool(players),
        queueState: emptyState,
      })
    ).toBeNull();
  });

  it('prefers players with fewer games over higher-DUPR players with more games', () => {
    const players = [
      withDoublesRating(createPlayer({ id: 'low1', name: 'L1' }), 4.5),
      withDoublesRating(createPlayer({ id: 'low2', name: 'L2' }), 4.5),
      withDoublesRating(createPlayer({ id: 'low3', name: 'L3' }), 4.5),
      withDoublesRating(createPlayer({ id: 'low4', name: 'L4' }), 4.5),
      withDoublesRating(createPlayer({ id: 'high1', name: 'H1' }), 3.0),
      withDoublesRating(createPlayer({ id: 'high2', name: 'H2' }), 3.0),
    ];
    players[4].gamesPlayed = 5;
    players[5].gamesPlayed = 5;

    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'balanced',
      players: pool(players),
      queueState: emptyState,
    });

    expect(entry?.playerIds).toHaveLength(4);
    expect(entry?.playerIds).not.toContain('high1');
    expect(entry?.playerIds).not.toContain('high2');
  });

  it('deprioritizes late check-ins over on-time players with equal games (singles)', () => {
    const sessionSettings = {
      sessionStartTime: sessionStart,
      arrivalGraceMinutes: 10,
      arrivalPenaltyEnabled: true,
    };
    const onTime = withCheckIn(
      withSinglesRating(createPlayer({ id: 'on', name: 'On Time' }), 3.5),
      sessionStart
    );
    const late = withCheckIn(
      withSinglesRating(createPlayer({ id: 'late', name: 'Late' }), 3.0),
      sessionStart + 30 * 60 * 1000
    );
    const partner = withCheckIn(
      withSinglesRating(createPlayer({ id: 'partner', name: 'Partner' }), 3.4),
      sessionStart
    );

    const entry = service.buildMatch({
      courtFormat: 'singles',
      matchMode: 'balanced',
      players: [onTime, late, partner],
      queueState: emptyState,
      sessionSettings,
    });

    expect(entry?.playerIds).toEqual(expect.arrayContaining(['on', 'partner']));
    expect(entry?.playerIds).not.toContain('late');
  });

  it('does not apply late minutes when arrival penalty is disabled', () => {
    const context = ranker.createContext({
      sessionStartTime: sessionStart,
      arrivalGraceMinutes: 10,
      arrivalPenaltyEnabled: false,
    });
    const late = withCheckIn(
      withSinglesRating(createPlayer({ id: 'late', name: 'Late' }), 3.0),
      sessionStart + 30 * 60 * 1000
    );

    expect(ranker.lateMinutes(late, context)).toBe(0);
    expect(ranker.fairnessSortScore(late, context, true)).toBe(3.0);
  });

  it('builds a balanced quartet from six players without pairing extreme DUPR outliers', () => {
    const players = [2.0, 2.0, 3.0, 3.0, 5.0, 5.0].map((rating, i) =>
      withDoublesRating(createPlayer({ id: `p${i}`, name: `P${i}` }), rating)
    );
    const context = ranker.createContext();
    const entry = buildDoublesBalancedMatch(pool(players), context, ranker);

    expect(entry?.playerIds).toHaveLength(4);
    expect(entry?.playerIds).not.toContain('p4');
    expect(entry?.playerIds).not.toContain('p5');
  });

  it('forms expert+intermediate mirror teams when four zero-game outliers block the first bucket', () => {
    const outliers = [
      withDoublesRating(createPlayer({ id: 'pj', name: 'PJ' }), 1.1),
      withDoublesRating(createPlayer({ id: 'carmen', name: 'Carmen', gender: 'female' }), 5.0),
      withDoublesRating(createPlayer({ id: 'jesse', name: 'Jesse', gender: 'male' }), 5.0),
      withDoublesRating(createPlayer({ id: 'mel', name: 'Mel', gender: 'female' }), 1.0),
    ];
    outliers.forEach((player) => {
      player.gamesPlayed = 0;
    });

    const core = [
      withDoublesRating(createPlayer({ id: 'dan', name: 'Dan', gender: 'male' }), 3.5),
      withDoublesRating(createPlayer({ id: 'michael', name: 'Michael', gender: 'male' }), 3.5),
      withDoublesRating(createPlayer({ id: 'mary', name: 'Mary', gender: 'female' }), 3.5),
      withDoublesRating(createPlayer({ id: 'joy', name: 'Joy', gender: 'female' }), 3.5),
    ];
    core.forEach((player) => {
      player.gamesPlayed = 1;
    });

    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'balanced',
      players: pool([...outliers, ...core]),
      queueState: emptyState,
    });

    expect(entry?.playerIds).toHaveLength(4);
    expect(entry?.playerIds).not.toContain('pj');
    expect(entry?.playerIds).not.toContain('mel');
  });

  it('finds tier-mirrored balanced doubles in a wide DUPR pool', () => {
    const ratings = [
      { id: 'carmen', rating: 5.0, gender: 'female' as const },
      { id: 'jesse', rating: 5.0, gender: 'male' as const },
      { id: 'epay', rating: 5.0, gender: 'female' as const },
      { id: 'klein', rating: 4.0, gender: 'male' as const },
      { id: 'dan', rating: 3.5, gender: 'male' as const },
      { id: 'michael', rating: 3.5, gender: 'male' as const },
      { id: 'mary', rating: 3.5, gender: 'female' as const },
      { id: 'joy', rating: 3.5, gender: 'female' as const },
      { id: 'jenny', rating: 2.5, gender: 'female' as const },
      { id: 'ben', rating: 2.0, gender: 'male' as const },
      { id: 'jean', rating: 1.5, gender: 'female' as const },
      { id: 'pj', rating: 1.1, gender: 'male' as const },
    ];
    const players = ratings.map(({ id, rating, gender }) =>
      withDoublesRating(createPlayer({ id, name: id, gender }), rating)
    );
    players.forEach((player) => {
      player.gamesPlayed = 1;
    });

    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'balanced',
      players: pool(players),
      queueState: emptyState,
    });

    expect(entry?.playerIds).toHaveLength(4);
    expect(entry?.playerIds).not.toContain('pj');
    expect(entry?.playerIds).not.toContain('jean');
  });

  it('never selects unchecked-in players', () => {
    const players = [
      createPlayer({ id: 'in1', name: 'In1', checkedIn: true }),
      createPlayer({ id: 'in2', name: 'In2', checkedIn: true }),
      createPlayer({ id: 'in3', name: 'In3', checkedIn: true }),
      createPlayer({ id: 'in4', name: 'In4', checkedIn: true }),
      createPlayer({ id: 'out', name: 'Out', checkedIn: false }),
    ];

    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'balanced',
      players,
      queueState: emptyState,
    });

    expect(entry?.playerIds).toHaveLength(4);
    expect(entry?.playerIds).not.toContain('out');
  });

  it('keeps synergy pair on the same team when Synergy Team is on', () => {
    const players = [
      withDoublesRating(createPlayer({ id: 'a', name: 'A' }), 4.0),
      withDoublesRating(createPlayer({ id: 'b', name: 'B' }), 2.0),
      withDoublesRating(createPlayer({ id: 'c', name: 'C' }), 4.0),
      withDoublesRating(createPlayer({ id: 'd', name: 'D' }), 2.0),
    ];

    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'balanced',
      players: pool(players),
      queueState: emptyState,
      sessionSettings: {
        synergyTeamsEnabled: true,
        synergyPairs: [['a', 'b']],
      },
    });

    expect(entry?.playerIds).toHaveLength(4);
    const { teamA, teamB } = splitTeams(entry!.playerIds);
    const onSameTeam =
      (teamA.includes('a') && teamA.includes('b')) ||
      (teamB.includes('a') && teamB.includes('b'));
    expect(onSameTeam).toBe(true);
  });

  it('includes both synergy partners in the same match when both are available', () => {
    const players = [
      withDoublesRating(createPlayer({ id: 'jon', name: 'Jon' }), 0),
      withDoublesRating(createPlayer({ id: 'darling', name: 'Darling', gender: 'female' }), 0),
      withDoublesRating(createPlayer({ id: 'aj', name: 'AJ' }), 0),
      withDoublesRating(createPlayer({ id: 'doc', name: 'Doc' }), 0),
      withDoublesRating(createPlayer({ id: 'reggie', name: 'Reggie' }), 0),
      withDoublesRating(createPlayer({ id: 'chrammy', name: 'Chrammy', gender: 'female' }), 0),
    ];

    const entry = service.buildMatch({
      courtFormat: 'doubles',
      matchMode: 'balanced',
      players: pool(players),
      queueState: emptyState,
      sessionSettings: {
        synergyTeamsEnabled: true,
        synergyPairs: [['jon', 'darling']],
      },
    });

    expect(entry?.playerIds).toEqual(expect.arrayContaining(['jon', 'darling']));
    const { teamA, teamB } = splitTeams(entry!.playerIds);
    const onSameTeam =
      (teamA.includes('jon') && teamA.includes('darling')) ||
      (teamB.includes('jon') && teamB.includes('darling'));
    expect(onSameTeam).toBe(true);
  });
});
