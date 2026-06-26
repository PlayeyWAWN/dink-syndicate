import {
  assignPlayerFromPoolToBench,
  buildInitialLadderSeeding,
  fillLadderBenchesFromWaitingPool,
  maybeFillLadderBenchesFromWaitingPool,
  getLadderUpNextPlayerIds,
  previewLadderMovement,
  reconcileLadderWithCheckedInPlayers,
  removePlayerFromLadder,
  returnBenchPlayerToPool,
  returnLadderMatchToBench,
  routePlayersAfterLadderMatch,
  sortWaitingPoolByFairness,
  startLadderMatchOnCourt,
  tryStartReadyLadderMatches,
} from '@/modules/game-mode/ladderWaterfallMode';
import { createCourt } from '@/types/court';
import { emptyLadderWaterfallState } from '@/types/ladder-waterfall';
import { createPlayer } from '@/types/player';
import { QueueState } from '@/types/queue';

const courts = [createCourt(0), createCourt(1), createCourt(2)];

function baseState(overrides: Partial<QueueState> = {}): QueueState {
  return {
    queue: [],
    activeMatches: [],
    completedMatches: [],
    ladderWaterfall: emptyLadderWaterfallState(),
    ...overrides,
  };
}

function makePlayers(count: number, baseRating = 5): ReturnType<typeof createPlayer>[] {
  return Array.from({ length: count }, (_, index) =>
    createPlayer({
      id: `p${index + 1}`,
      name: `Player ${index + 1}`,
      duprDoublesRating: Math.max(0, baseRating - index * 0.5),
      checkedIn: true,
    })
  );
}

describe('ladderWaterfallMode', () => {
  it('seeds 12 players across 3 courts by DUPR descending', () => {
    const players = makePlayers(12);
    const ids = players.map((player) => player.id);
    const seeded = buildInitialLadderSeeding(ids, courts, players);

    expect(seeded.benchByCourtId[courts[0].id]).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(seeded.benchByCourtId[courts[1].id]).toEqual(['p5', 'p6', 'p7', 'p8']);
    expect(seeded.benchByCourtId[courts[2].id]).toEqual(['p9', 'p10', 'p11', 'p12']);
    expect(seeded.waitingPool).toEqual([]);
  });

  it('puts overflow players in the waiting pool', () => {
    const players = makePlayers(10);
    const ids = players.map((player) => player.id);
    const seeded = buildInitialLadderSeeding(ids, courts.slice(0, 2), players);

    expect(seeded.benchByCourtId[courts[0].id]).toHaveLength(4);
    expect(seeded.benchByCourtId[courts[1].id]).toHaveLength(4);
    expect(seeded.waitingPool).toEqual(['p9', 'p10']);
  });

  it('reconcile full DUPR seeds when the ladder was cleared for a new session', () => {
    const players = makePlayers(12);
    const reversedRosterOrder = [...players].reverse();
    const cleared: QueueState = {
      queue: [],
      activeMatches: [],
      completedMatches: [],
      rotationPaused: true,
    };

    const reconciled = reconcileLadderWithCheckedInPlayers(
      cleared,
      reversedRosterOrder,
      courts
    );

    expect(reconciled.ladderWaterfall?.benchByCourtId[courts[0].id]).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
    ]);
    expect(reconciled.ladderWaterfall?.benchByCourtId[courts[2].id]).toEqual(
      expect.arrayContaining(['p9', 'p10', 'p11', 'p12'])
    );
    expect(reconciled.ladderWaterfall?.benchByCourtId[courts[2].id]).toHaveLength(4);
  });

  it('routes winners up and losers down after a match on Court 2', () => {
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: [],
          [courts[1].id]: [],
          [courts[2].id]: [],
        },
        waitingPool: [],
        lastPartnerByPlayer: {},
      },
    });

    const routed = routePlayersAfterLadderMatch(
      state,
      {
        playerIds: ['w1', 'w2', 'l1', 'l2'],
        ladderMeta: {
          courtId: courts[1].id,
          courtRank: 1,
          benchPullOrder: ['w1', 'w2', 'l1', 'l2'],
        },
      },
      'A',
      courts
    );

    expect(routed.ladderWaterfall?.benchByCourtId[courts[0].id]).toEqual(['w1', 'w2']);
    expect(routed.ladderWaterfall?.benchByCourtId[courts[2].id]).toEqual(['l1', 'l2']);
  });

  it('keeps top-court winners and bottom-court losers on the same court', () => {
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: [],
          [courts[1].id]: [],
          [courts[2].id]: [],
        },
        waitingPool: [],
        lastPartnerByPlayer: {},
      },
    });

    const topRouted = routePlayersAfterLadderMatch(
      state,
      {
        playerIds: ['w1', 'w2', 'l1', 'l2'],
        ladderMeta: {
          courtId: courts[0].id,
          courtRank: 0,
          benchPullOrder: ['w1', 'w2', 'l1', 'l2'],
        },
      },
      'A',
      courts
    );
    expect(topRouted.ladderWaterfall?.benchByCourtId[courts[0].id]).toEqual(['w1', 'w2']);
    expect(topRouted.ladderWaterfall?.benchByCourtId[courts[1].id]).toEqual(['l1', 'l2']);

    const bottomRouted = routePlayersAfterLadderMatch(
      state,
      {
        playerIds: ['w3', 'w4', 'l3', 'l4'],
        ladderMeta: {
          courtId: courts[2].id,
          courtRank: 2,
          benchPullOrder: ['w3', 'w4', 'l3', 'l4'],
        },
      },
      'A',
      courts
    );
    expect(bottomRouted.ladderWaterfall?.benchByCourtId[courts[1].id]).toEqual(['w3', 'w4']);
    expect(bottomRouted.ladderWaterfall?.benchByCourtId[courts[2].id]).toEqual(['l3', 'l4']);
  });

  describe('previewLadderMovement', () => {
    const matchOnCourt2 = {
      playerIds: ['w1', 'w2', 'l1', 'l2'],
      ladderMeta: {
        courtId: courts[1].id,
        courtRank: 1,
        benchPullOrder: ['w1', 'w2', 'l1', 'l2'],
      },
    };

    it('previews winners moving up and losers moving down from middle court', () => {
      const preview = previewLadderMovement(matchOnCourt2, 'A', courts);
      expect(preview).not.toBeNull();
      expect(preview!.winnerPlayerIds).toEqual(['w1', 'w2']);
      expect(preview!.loserPlayerIds).toEqual(['l1', 'l2']);
      expect(preview!.winnerTargetCourtLabel).toBe(courts[0].label);
      expect(preview!.loserTargetCourtLabel).toBe(courts[2].label);
      expect(preview!.winnerDirection).toBe('up');
      expect(preview!.loserDirection).toBe('down');
    });

    it('previews top-court winners staying and losers moving down', () => {
      const preview = previewLadderMovement(
        {
          playerIds: ['w1', 'w2', 'l1', 'l2'],
          ladderMeta: {
            courtId: courts[0].id,
            courtRank: 0,
            benchPullOrder: ['w1', 'w2', 'l1', 'l2'],
          },
        },
        'A',
        courts
      );
      expect(preview!.winnerDirection).toBe('stay');
      expect(preview!.loserDirection).toBe('down');
      expect(preview!.winnerTargetCourtLabel).toBe(courts[0].label);
      expect(preview!.loserTargetCourtLabel).toBe(courts[1].label);
    });

    it('previews bottom-court winners moving up and losers staying', () => {
      const preview = previewLadderMovement(
        {
          playerIds: ['w1', 'w2', 'l1', 'l2'],
          ladderMeta: {
            courtId: courts[2].id,
            courtRank: 2,
            benchPullOrder: ['w1', 'w2', 'l1', 'l2'],
          },
        },
        'A',
        courts
      );
      expect(preview!.winnerDirection).toBe('up');
      expect(preview!.loserDirection).toBe('stay');
      expect(preview!.winnerTargetCourtLabel).toBe(courts[1].label);
      expect(preview!.loserTargetCourtLabel).toBe(courts[2].label);
    });

    it('returns null when ladder meta is missing', () => {
      expect(
        previewLadderMovement({ playerIds: ['a', 'b', 'c', 'd'] }, 'A', courts)
      ).toBeNull();
    });
  });

  it('starts a match when a bench has four players', () => {
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: ['p1', 'p2', 'p3', 'p4'],
          [courts[1].id]: [],
          [courts[2].id]: [],
        },
        waitingPool: [],
        lastPartnerByPlayer: {},
      },
    });

    const { state: nextState, match } = startLadderMatchOnCourt(state, courts[0].id, courts);
    expect(match).not.toBeNull();
    expect(match!.playerIds).toHaveLength(4);
    expect(match!.ladderMeta?.courtRank).toBe(0);
    expect(nextState.ladderWaterfall?.benchByCourtId[courts[0].id]).toEqual([]);
    expect(nextState.activeMatches).toHaveLength(1);
  });

  it('auto-starts ready courts via tryStartReadyLadderMatches', () => {
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: ['p1', 'p2', 'p3', 'p4'],
          [courts[1].id]: ['p5', 'p6', 'p7', 'p8'],
          [courts[2].id]: [],
        },
        waitingPool: [],
        lastPartnerByPlayer: {},
      },
    });

    const { state: nextState, matches } = tryStartReadyLadderMatches(state, courts);
    expect(matches).toHaveLength(2);
    expect(nextState.activeMatches).toHaveLength(2);
  });

  it('returns players to the source bench when a match is cancelled', () => {
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: ['p1', 'p2', 'p3', 'p4'],
          [courts[1].id]: [],
          [courts[2].id]: [],
        },
        waitingPool: [],
        lastPartnerByPlayer: {},
      },
    });

    const { state: afterStart, match } = startLadderMatchOnCourt(state, courts[0].id, courts);
    const afterCancel = returnLadderMatchToBench(afterStart, match!);
    expect(afterCancel.ladderWaterfall?.benchByCourtId[courts[0].id]).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
    ]);
  });

  it('removes a player from bench and waiting pool on check-out', () => {
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: ['p1', 'p2'],
          [courts[1].id]: ['p3'],
        },
        waitingPool: ['p4'],
        lastPartnerByPlayer: {},
      },
    });

    const next = removePlayerFromLadder(state, 'p2');
    expect(next.ladderWaterfall?.benchByCourtId[courts[0].id]).toEqual(['p1']);
    expect(next.ladderWaterfall?.waitingPool).toEqual(['p4']);

    const nextPool = removePlayerFromLadder(next, 'p4');
    expect(nextPool.ladderWaterfall?.waitingPool).toEqual([]);
  });

  it('assigns a waiting-pool player to an open bench slot manually', () => {
    const players = makePlayers(5);
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: ['p1', 'p2', 'p3'],
          [courts[1].id]: [],
          [courts[2].id]: [],
        },
        waitingPool: ['p4', 'p5'],
        lastPartnerByPlayer: {},
      },
    });

    const assigned = assignPlayerFromPoolToBench(state, 'p5', courts[0].id, courts);
    expect(assigned?.ladderWaterfall?.benchByCourtId[courts[0].id]).toEqual([
      'p1',
      'p2',
      'p3',
      'p5',
    ]);
    expect(assigned?.ladderWaterfall?.waitingPool).toEqual(['p4']);
  });

  it('returns a benched player to the waiting pool manually', () => {
    const players = makePlayers(5);
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: ['p1', 'p2', 'p3', 'p4'],
          [courts[1].id]: [],
          [courts[2].id]: [],
        },
        waitingPool: ['p5'],
        lastPartnerByPlayer: {},
      },
    });

    const returned = returnBenchPlayerToPool(state, 'p4', courts[0].id, players);
    expect(returned?.ladderWaterfall?.benchByCourtId[courts[0].id]).toEqual(['p1', 'p2', 'p3']);
    expect(returned?.ladderWaterfall?.waitingPool).toEqual(['p4', 'p5']);
  });

  it('orders waiting pool by fewest games played', () => {
    const players = [
      { ...createPlayer({ id: 'a', name: 'Chris' }), gamesPlayed: 0 },
      { ...createPlayer({ id: 'b', name: 'Emily' }), gamesPlayed: 9 },
      { ...createPlayer({ id: 'c', name: 'Alex' }), gamesPlayed: 2 },
    ];
    expect(sortWaitingPoolByFairness(['b', 'a', 'c'], players)).toEqual(['a', 'c', 'b']);
  });

  it('backfills open bench slots from the waiting pool', () => {
    const players = [
      { ...createPlayer({ id: 'p1', name: 'Veteran' }), gamesPlayed: 9 },
      { ...createPlayer({ id: 'p2', name: 'Chris' }), gamesPlayed: 0 },
    ];
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: ['x1', 'x2', 'x3', 'x4'],
          [courts[1].id]: ['x5', 'x6', 'x7', 'x8'],
          [courts[2].id]: ['x9', 'x10', 'x11'],
        },
        waitingPool: ['p1', 'p2'],
        lastPartnerByPlayer: {},
      },
    });

    const filled = fillLadderBenchesFromWaitingPool(state, courts, players);
    expect(filled.ladderWaterfall?.waitingPool).toEqual(['p1']);
    expect(filled.ladderWaterfall?.benchByCourtId[courts[2].id]).toEqual(['x9', 'x10', 'x11', 'p2']);
  });

  it('skips waiting-pool backfill while rotation is paused', () => {
    const players = [
      { ...createPlayer({ id: 'p1', name: 'Veteran' }), gamesPlayed: 9 },
      { ...createPlayer({ id: 'p2', name: 'Chris' }), gamesPlayed: 0 },
    ];
    const state = baseState({
      rotationPaused: true,
      ladderWaterfall: {
        benchByCourtId: {
          [courts[0].id]: ['x1', 'x2', 'x3', 'x4'],
          [courts[1].id]: ['x5', 'x6', 'x7', 'x8'],
          [courts[2].id]: ['x9', 'x10', 'x11'],
        },
        waitingPool: ['p1', 'p2'],
        lastPartnerByPlayer: {},
      },
    });

    const unchanged = maybeFillLadderBenchesFromWaitingPool(state, courts, players);
    expect(unchanged).toBe(state);
    expect(unchanged.ladderWaterfall?.waitingPool).toEqual(['p1', 'p2']);
    expect(unchanged.ladderWaterfall?.benchByCourtId[courts[2].id]).toEqual(['x9', 'x10', 'x11']);
  });

  it('returns up-next players from the head of the fairness-ordered pool', () => {
    const players = [
      { ...createPlayer({ id: 'p1', name: 'Chris' }), gamesPlayed: 0 },
      { ...createPlayer({ id: 'p2', name: 'Emily' }), gamesPlayed: 9 },
    ];
    const state = baseState({
      ladderWaterfall: {
        benchByCourtId: { [courts[0].id]: [], [courts[1].id]: [], [courts[2].id]: [] },
        waitingPool: ['p2', 'p1'],
        lastPartnerByPlayer: {},
      },
    });

    expect(getLadderUpNextPlayerIds(state, players, 1)).toEqual(['p1']);
  });
});
