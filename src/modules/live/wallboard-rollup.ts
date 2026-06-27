import { WallboardDailyRollup } from '@/types/analytics';
import { LiveSessionSnapshot } from '@/types/live';

/** Merge a finished publish session into the daily wallboard rollup. */
export function mergeWallboardDailyRollup(
  prev: WallboardDailyRollup,
  stats: LiveSessionSnapshot['viewerStats'],
  now = Date.now()
): WallboardDailyRollup {
  return {
    date: prev.date,
    totalUniqueViewers: prev.totalUniqueViewers + stats.totalUnique,
    peakConcurrent: Math.max(prev.peakConcurrent, stats.peakConcurrent),
    totalViewMinutes: prev.totalViewMinutes + stats.totalViewMinutes,
    sessionsPublished: prev.sessionsPublished + 1,
    updatedAt: now,
  };
}

export function emptyWallboardDailyRollup(date: string, now = Date.now()): WallboardDailyRollup {
  return {
    date,
    totalUniqueViewers: 0,
    peakConcurrent: 0,
    totalViewMinutes: 0,
    sessionsPublished: 0,
    updatedAt: now,
  };
}
