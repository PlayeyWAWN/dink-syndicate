import {
  computeQueueAnalytics,
  formatUtilizationPercent,
} from '@/modules/stats/QueueAnalyticsService';
import { createPlayer } from '@/types/player';
import { Match, QueueState } from '@/types/queue';

const courts = [
  { id: 'court-1', label: '1', activeMatchId: null },
  { id: 'court-2', label: '2', activeMatchId: null },
];

describe('QueueAnalyticsService', () => {
  it('computes average queue wait from completed and current queue entries', () => {
    const queueState: QueueState = {
      queue: [
        {
          id: 'q1',
          playerIds: ['p1', 'p2'],
          format: 'doubles',
          createdAt: 4_000,
        },
      ],
      activeMatches: [],
      completedMatches: [
        {
          id: 'm1',
          courtId: 'court-1',
          playerIds: ['p3', 'p4'],
          format: 'doubles',
          status: 'completed',
          winnerPlayerIds: ['p3', 'p4'],
          queuedAt: 1_000,
          startedAt: 2_000,
          completedAt: 8_000,
        },
      ],
    };

    const analytics = computeQueueAnalytics({
      queueState,
      courts,
      players: [],
      now: 10_000,
    });

    expect(analytics.avgQueueWaitMs).toBe(3_500);
    expect(analytics.avgMatchDurationMs).toBe(6_000);
    expect(analytics.currentQueueDepth).toBe(1);
  });

  it('computes court utilization from session start and match durations', () => {
    const queueState: QueueState = {
      queue: [],
      activeMatches: [
        {
          id: 'm2',
          courtId: 'court-1',
          playerIds: ['p1', 'p2'],
          format: 'doubles',
          status: 'active',
          winnerPlayerIds: [],
          startedAt: 8_000,
        },
      ],
      completedMatches: [
        {
          id: 'm1',
          courtId: 'court-1',
          playerIds: ['p3', 'p4'],
          format: 'doubles',
          status: 'completed',
          winnerPlayerIds: ['p3', 'p4'],
          startedAt: 2_000,
          completedAt: 6_000,
        },
      ],
    };

    const analytics = computeQueueAnalytics({
      queueState,
      courts,
      players: [],
      sessionStartTime: 0,
      now: 10_000,
    });

    expect(formatUtilizationPercent(analytics.courtUtilizationPercent)).toBe('30%');
  });

  it('tracks longest available-player wait from snapshots and current pool', () => {
    const queueState: QueueState = {
      queue: [],
      activeMatches: [],
      completedMatches: [
        {
          id: 'm1',
          courtId: 'court-1',
          playerIds: ['p1', 'p2'],
          format: 'doubles',
          status: 'completed',
          winnerPlayerIds: ['p1', 'p2'],
          startedAt: 5_000,
          availableSinceByPlayer: { p1: 1_000, p2: 3_000 },
          completedAt: 9_000,
        },
      ],
    };

    const players = [
      { ...createPlayer({ id: 'p3', name: 'Pat' }), checkedIn: true, availableSince: 8_000 },
    ];

    const analytics = computeQueueAnalytics({
      queueState,
      courts,
      players,
      now: 10_000,
    });

    expect(analytics.longestAvailableWaitMs).toBe(4_000);
    expect(analytics.matchesCompletedLastHour).toBe(1);
  });
});
