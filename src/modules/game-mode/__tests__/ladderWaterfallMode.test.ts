import {
  buildInitialLadderSeeding,
  removePlayerFromLadder,
  returnLadderMatchToBench,
  routePlayersAfterLadderMatch,
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
});
