import {
  computeArrivalAnalytics,
  determineArrivalTier,
} from '@/modules/stats/ArrivalAnalyticsService';
import { createPlayer } from '@/types/player';

const sessionStart = Date.parse('2026-06-24T10:10:00');

describe('determineArrivalTier', () => {
  it('classifies early, on time, grace, late, and very late', () => {
    expect(determineArrivalTier(sessionStart - 5 * 60_000, sessionStart, 10)).toBe('early');
    expect(determineArrivalTier(sessionStart, sessionStart, 10)).toBe('onTime');
    expect(determineArrivalTier(sessionStart + 5 * 60_000, sessionStart, 10)).toBe('grace');
    expect(determineArrivalTier(sessionStart + 20 * 60_000, sessionStart, 10)).toBe('late');
    expect(determineArrivalTier(sessionStart + 45 * 60_000, sessionStart, 10)).toBe('veryLate');
  });
});

describe('computeArrivalAnalytics', () => {
  it('returns unconfigured when session start is missing', () => {
    const result = computeArrivalAnalytics([createPlayer({ id: 'p1', name: 'April' })], undefined);
    expect(result.configured).toBe(false);
  });

  it('groups checked-in players by tier', () => {
    const players = [
      {
        ...createPlayer({ id: 'p1', name: 'April', checkedIn: true }),
        checkedInAt: sessionStart,
      },
      {
        ...createPlayer({ id: 'p2', name: 'Ben', checkedIn: true }),
        checkedInAt: sessionStart + 8 * 60_000,
      },
      {
        ...createPlayer({ id: 'p3', name: 'Cedie', checkedIn: false }),
      },
    ];

    const result = computeArrivalAnalytics(players, {
      courtCount: 4,
      organizerName: 'Host',
      sessionStartTime: sessionStart,
      arrivalGraceMinutes: 10,
      arrivalPenaltyEnabled: true,
      lateMinutesWeight: 10,
    });

    expect(result.configured).toBe(true);
    expect(result.playersByTier.onTime.map((p) => p.name)).toEqual(['April']);
    expect(result.playersByTier.grace.map((p) => p.name)).toEqual(['Ben']);
    expect(result.playersByTier.notCheckedIn.map((p) => p.name)).toEqual(['Cedie']);
    expect(result.summaries.grace.avgPenaltyScore).toBe(0);
  });
});
