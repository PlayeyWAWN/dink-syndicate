import {
  emptyWallboardDailyRollup,
  mergeWallboardDailyRollup,
} from '@/modules/live/wallboard-rollup';

describe('mergeWallboardDailyRollup', () => {
  it('accumulates viewer stats and increments sessions published', () => {
    const prev = emptyWallboardDailyRollup('2026-06-27');
    const merged = mergeWallboardDailyRollup(prev, {
      totalUnique: 12,
      peakConcurrent: 5,
      totalViewMinutes: 45,
      publishStartedAt: Date.now(),
    });

    expect(merged.totalUniqueViewers).toBe(12);
    expect(merged.peakConcurrent).toBe(5);
    expect(merged.totalViewMinutes).toBe(45);
    expect(merged.sessionsPublished).toBe(1);
  });

  it('keeps peak concurrent at the daily high', () => {
    const prev = {
      ...emptyWallboardDailyRollup('2026-06-27'),
      peakConcurrent: 8,
      totalUniqueViewers: 20,
      totalViewMinutes: 100,
      sessionsPublished: 2,
    };

    const merged = mergeWallboardDailyRollup(prev, {
      totalUnique: 5,
      peakConcurrent: 3,
      totalViewMinutes: 20,
      publishStartedAt: Date.now(),
    });

    expect(merged.peakConcurrent).toBe(8);
    expect(merged.totalUniqueViewers).toBe(25);
    expect(merged.totalViewMinutes).toBe(120);
    expect(merged.sessionsPublished).toBe(3);
  });
});
