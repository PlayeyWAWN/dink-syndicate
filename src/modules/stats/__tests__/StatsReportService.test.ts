import {
  buildPairStatistics,
  buildPlayersNeedingEncouragement,
  buildIndexedRankingsRows,
  buildRankingsRows,
  buildStatsReportData,
} from '@/modules/stats/StatsReportService';
import { computeQueueAnalytics } from '@/modules/stats/QueueAnalyticsService';
import { createPlayer } from '@/types/player';
import { Match } from '@/types/queue';

describe('StatsReportService', () => {
  it('ranks star players by points with a minimum games threshold', () => {
    const players = [
      { ...createPlayer({ id: 'p1', name: 'Alice' }), gamesPlayed: 4, wins: 3, losses: 1 },
      { ...createPlayer({ id: 'p2', name: 'Bob' }), gamesPlayed: 3, wins: 3, losses: 0 },
      { ...createPlayer({ id: 'p3', name: 'Cara' }), gamesPlayed: 1, wins: 1, losses: 0 },
    ];

    const report = buildStatsReportData({
      statsView: 'session',
      sessionName: 'Host',
      players,
      completedMatches: [],
      activeMatchCount: 0,
      analytics: computeQueueAnalytics({ queueState: { queue: [], activeMatches: [], completedMatches: [] }, courts: [], players: [] }),
    });

    expect(report.starPlayers.map((row) => row.name)).toEqual(['Alice', 'Bob']);
  });

  it('ranks active players above campers in the main rankings table', () => {
    const players = [
      { ...createPlayer({ id: 'p1', name: 'Camper' }), gamesPlayed: 5, wins: 5, losses: 0 },
      { ...createPlayer({ id: 'p2', name: 'Active' }), gamesPlayed: 10, wins: 6, losses: 4 },
    ];

    const rankings = buildRankingsRows(players, 'session');
    expect(rankings.map((row) => row.name)).toEqual(['Active', 'Camper']);
    expect(rankings[0]?.points).toBe(22);
    expect(rankings[1]?.points).toBe(15);
  });

  it('aggregates top performing pairs from completed doubles matches', () => {
    const players = [
      createPlayer({ id: 'p1', name: 'Alice' }),
      createPlayer({ id: 'p2', name: 'Bob' }),
      createPlayer({ id: 'p3', name: 'Cara' }),
      createPlayer({ id: 'p4', name: 'Dan' }),
    ];

    const completedMatches: Match[] = [
      {
        id: 'm1',
        courtId: 'court-1',
        playerIds: ['p1', 'p2', 'p3', 'p4'],
        format: 'doubles',
        status: 'completed',
        winnerPlayerIds: ['p1', 'p2'],
        completedAt: Date.now(),
      },
      {
        id: 'm2',
        courtId: 'court-1',
        playerIds: ['p1', 'p2', 'p3', 'p4'],
        format: 'doubles',
        status: 'completed',
        winnerPlayerIds: ['p1', 'p2'],
        completedAt: Date.now(),
      },
    ];

    const pairs = buildPairStatistics(completedMatches, players);
    expect(pairs[0]?.label).toBe('Alice & Bob');
    expect(pairs[0]?.wins).toBe(2);
    expect(pairs[0]?.losses).toBe(0);
  });

  it('flags players with the most losses for encouragement', () => {
    const players = [
      { ...createPlayer({ id: 'p1', name: 'Alice' }), gamesPlayed: 4, wins: 3, losses: 1 },
      { ...createPlayer({ id: 'p2', name: 'Bob' }), gamesPlayed: 4, wins: 0, losses: 4 },
      { ...createPlayer({ id: 'p3', name: 'Cara' }), gamesPlayed: 3, wins: 1, losses: 2 },
    ];

    const need = buildPlayersNeedingEncouragement(players, 'session');
    expect(need.map((row) => row.name)).toEqual(['Bob']);
  });

  it('filters indexed rankings by name while preserving rank positions', () => {
    const players = [
      { ...createPlayer({ id: 'p1', name: 'Alice' }), gamesPlayed: 2, wins: 2, losses: 0 },
      { ...createPlayer({ id: 'p2', name: 'Bob' }), gamesPlayed: 1, wins: 1, losses: 0 },
      { ...createPlayer({ id: 'p3', name: 'John Smith' }), gamesPlayed: 0, wins: 0, losses: 0 },
    ];

    const filtered = buildIndexedRankingsRows(players, 'session', 'john');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.row.name).toBe('John Smith');
    expect(filtered[0]?.rankIndex).toBe(2);
  });
});
