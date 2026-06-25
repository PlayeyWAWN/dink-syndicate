import {
  buildMatchHistoryCsv,
  buildMatchHistoryTxt,
} from '@/lib/match-history-export';
import {
  buildMatchHistoryData,
  longestMatchDurationMs,
  longestMatchQueueWaitMs,
  paginateItems,
} from '@/modules/stats/MatchHistoryService';
import { computeQueueAnalytics } from '@/modules/stats/QueueAnalyticsService';
import { createPlayer } from '@/types/player';
import { Match } from '@/types/queue';

describe('MatchHistoryService', () => {
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
      queuedAt: 1_000,
      startedAt: 2_000,
      completedAt: 4_000,
    },
    {
      id: 'm2',
      courtId: 'court-1',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      format: 'doubles',
      status: 'completed',
      winnerPlayerIds: ['p3', 'p4'],
      queuedAt: 5_000,
      startedAt: 10_000,
      completedAt: 20_000,
    },
  ];

  it('orders completed matches newest first with descending match numbers', () => {
    const analytics = computeQueueAnalytics({
      queueState: { queue: [], activeMatches: [], completedMatches },
      courts: [],
      players: [],
    });

    const data = buildMatchHistoryData({ completedMatches, players, analytics });
    expect(data.matches.map((row) => row.matchNumber)).toEqual([2, 1]);
    expect(data.matches[0]?.winnerLabel).toBe('Cara & Dan');
    expect(data.matches[0]?.label).toBe('Alice & Bob vs Cara & Dan');
  });

  it('computes longest queue wait and match duration helpers', () => {
    expect(longestMatchQueueWaitMs(completedMatches)).toBe(5_000);
    expect(longestMatchDurationMs(completedMatches)).toBe(10_000);
  });

  it('exports match history as txt and csv', () => {
    const analytics = computeQueueAnalytics({
      queueState: { queue: [], activeMatches: [], completedMatches },
      courts: [],
      players: [],
    });
    const data = buildMatchHistoryData({ completedMatches, players, analytics });

    const txt = buildMatchHistoryTxt(data, 'Host');
    expect(txt).toContain('All Matches (2)');
    expect(txt).toContain('Winner: Cara & Dan');

    const csv = buildMatchHistoryCsv(data);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('Alice & Bob vs Cara & Dan');
  });

  it('includes correction notes in match history rows and exports', () => {
    const notedMatches: Match[] = [
      {
        ...completedMatches[0]!,
        correctionNote: 'Correct winner was Team 2',
      },
    ];
    const analytics = computeQueueAnalytics({
      queueState: { queue: [], activeMatches: [], completedMatches: notedMatches },
      courts: [],
      players: [],
    });
    const data = buildMatchHistoryData({
      completedMatches: notedMatches,
      players,
      analytics,
    });

    expect(data.matches[0]?.note).toBe('Correct winner was Team 2');
    expect(buildMatchHistoryTxt(data, 'Host')).toContain('Note: Correct winner was Team 2');
    expect(buildMatchHistoryCsv(data)).toContain('Correct winner was Team 2');
  });

  it('lists checked-in waiting players by longest wait', () => {
    const now = 100_000;
    const waitingPlayers = [
      {
        ...createPlayer({ id: 'p5', name: 'Eve', checkedIn: true }),
        availableSince: now - 30_000,
      },
      {
        ...createPlayer({ id: 'p6', name: 'Frank', checkedIn: true }),
        availableSince: now - 50_000,
      },
    ];

    const analytics = computeQueueAnalytics({
      queueState: { queue: [], activeMatches: [], completedMatches: [] },
      courts: [],
      players: waitingPlayers,
      now,
    });

    const data = buildMatchHistoryData({
      completedMatches: [],
      players: waitingPlayers,
      analytics,
      now,
    });

    expect(data.waitingPlayers.map((row) => row.name)).toEqual(['Frank', 'Eve']);
  });

  it('paginates match history in pages of five', () => {
    const items = Array.from({ length: 12 }, (_, index) => index + 1);
    const page1 = paginateItems(items, 0);
    const page3 = paginateItems(items, 2);

    expect(page1.items).toEqual([1, 2, 3, 4, 5]);
    expect(page1.totalPages).toBe(3);
    expect(page1.rangeStart).toBe(1);
    expect(page1.rangeEnd).toBe(5);

    expect(page3.items).toEqual([11, 12]);
    expect(page3.page).toBe(2);
    expect(page3.rangeStart).toBe(11);
    expect(page3.rangeEnd).toBe(12);
  });
});
