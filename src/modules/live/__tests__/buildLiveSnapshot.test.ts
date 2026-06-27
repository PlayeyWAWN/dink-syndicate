import { buildLiveSnapshot } from '@/modules/live/buildLiveSnapshot';
import { Court } from '@/types/court';
import { Player } from '@/types/player';
import { QueueState } from '@/types/queue';

const players: Player[] = [
  {
    id: 'p1',
    name: 'Alice',
    gender: 'female',
    excluded: false,
    checkedIn: true,
    gamesPlayed: 5,
    wins: 4,
    losses: 1,
    career: { gamesPlayed: 5, wins: 4, losses: 1 },
    dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: 4.2 },
    createdAt: 1,
    updatedAt: 2,
  },
  {
    id: 'p2',
    name: 'Bob',
    gender: 'male',
    excluded: false,
    checkedIn: true,
    gamesPlayed: 5,
    wins: 3,
    losses: 2,
    career: { gamesPlayed: 5, wins: 3, losses: 2 },
    dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: 3.8 },
    createdAt: 1,
    updatedAt: 2,
  },
  {
    id: 'p3',
    name: 'Cara',
    gender: 'female',
    excluded: false,
    checkedIn: true,
    gamesPlayed: 4,
    wins: 2,
    losses: 2,
    career: { gamesPlayed: 4, wins: 2, losses: 2 },
    dupr: { duprConnected: false, duprRatingSource: 'manual' },
    createdAt: 1,
    updatedAt: 2,
  },
  {
    id: 'p4',
    name: 'Dan',
    gender: 'male',
    excluded: false,
    checkedIn: true,
    gamesPlayed: 4,
    wins: 1,
    losses: 3,
    career: { gamesPlayed: 4, wins: 1, losses: 3 },
    dupr: { duprConnected: false, duprRatingSource: 'manual' },
    createdAt: 1,
    updatedAt: 2,
  },
];

const courts: Court[] = [
  { id: 'c1', label: 'Court 1', activeMatchId: 'm1' },
  { id: 'c2', label: 'Court 2', activeMatchId: null },
];

const queueState: QueueState = {
  queue: [
    {
      id: 'q1',
      playerIds: ['p3', 'p4'],
      format: 'doubles',
      createdAt: 1000,
      source: 'auto',
    },
  ],
  activeMatches: [
    {
      id: 'm1',
      courtId: 'c1',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      format: 'doubles',
      status: 'active',
      winnerPlayerIds: [],
      startedAt: 5000,
    },
  ],
  completedMatches: [
    {
      id: 'm0',
      courtId: 'c2',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      format: 'doubles',
      status: 'completed',
      winnerPlayerIds: ['p1', 'p2'],
      completedAt: 4000,
    },
  ],
};

describe('buildLiveSnapshot', () => {
  it('builds a public snapshot with rankings, queue, and matches', () => {
    const snapshot = buildLiveSnapshot({
      sessionId: 'sess-1',
      organizerName: 'Benedict Club',
      publishToken: 'abc123',
      isActive: true,
      settings: { organizerName: 'Benedict Club', courtCount: 2, gameMode: 'dupr_open_play' },
      courts,
      queueState,
      players,
      viewerStats: {
        totalUnique: 2,
        peakConcurrent: 3,
        totalViewMinutes: 10,
        publishStartedAt: Date.now(),
      },
    });

    expect(snapshot.organizerName).toBe('Benedict Club');
    expect(snapshot.gameMode).toBe('dupr_open_play');
    expect(snapshot.activeMatches).toHaveLength(1);
    expect(snapshot.activeMatches[0]?.courtLabel).toBe('Court 1');
    expect(snapshot.queueNext[0]?.label).toContain('Cara');
    expect(snapshot.completedMatches).toHaveLength(1);
    expect(snapshot.rankings.length).toBeLessThanOrEqual(10);
    expect(snapshot.rankings[0]?.playerId).toBe('p1');
    expect(snapshot.players).toHaveLength(4);
    expect(snapshot.players.find((p) => p.id === 'p1')?.name).toBe('Alice');
    expect(snapshot.viewerStats.totalUnique).toBe(2);
  });

  it('returns empty rankings until someone has played a game', () => {
    const noGamesPlayers = players.map((p) => ({ ...p, gamesPlayed: 0, wins: 0, losses: 0 }));
    const snapshot = buildLiveSnapshot({
      sessionId: 'sess-1',
      organizerName: 'Host',
      publishToken: 'tok',
      isActive: true,
      courts,
      queueState,
      players: noGamesPlayers,
      viewerStats: {
        totalUnique: 0,
        peakConcurrent: 0,
        totalViewMinutes: 0,
        publishStartedAt: Date.now(),
      },
    });

    expect(snapshot.rankings).toHaveLength(0);
  });

  it('computes ranking deltas against previous snapshot', () => {
    const first = buildLiveSnapshot({
      sessionId: 'sess-1',
      organizerName: 'Host',
      publishToken: 'tok',
      isActive: true,
      courts,
      queueState,
      players,
      viewerStats: {
        totalUnique: 0,
        peakConcurrent: 0,
        totalViewMinutes: 0,
        publishStartedAt: Date.now(),
      },
    });

    const swappedPlayers = players.map((p) =>
      p.id === 'p1' ? { ...p, wins: 1, losses: 4 } : { ...p, wins: 6, losses: 0 }
    );

    const second = buildLiveSnapshot({
      sessionId: 'sess-1',
      organizerName: 'Host',
      publishToken: 'tok',
      isActive: true,
      courts,
      queueState,
      players: swappedPlayers,
      previousRankings: first.rankings,
      viewerStats: {
        totalUnique: 0,
        peakConcurrent: 0,
        totalViewMinutes: 0,
        publishStartedAt: Date.now(),
      },
    });

    const aliceDelta = second.rankings.find((r) => r.playerId === 'p1')?.delta;
    expect(aliceDelta).toBe('down');
  });
});
