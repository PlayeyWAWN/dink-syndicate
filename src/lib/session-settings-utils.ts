import { MATCHMAKING_FAIRNESS } from '@/config/matchmaking';
import { AppSettings } from '@/types/app-data';

/** Minutes-based wait thresholds for available-player UI alerts. */
export function getAvailableWaitThresholds(settings?: AppSettings): {
  warnMs: number;
  criticalMs: number;
} {
  const warnMinutes = settings?.availableWaitWarnMinutes ?? MATCHMAKING_FAIRNESS.defaultAvailableWaitWarnMinutes;
  const criticalMinutes =
    settings?.availableWaitCriticalMinutes ?? MATCHMAKING_FAIRNESS.defaultAvailableWaitCriticalMinutes;
  return {
    warnMs: warnMinutes * 60 * 1000,
    criticalMs: criticalMinutes * 60 * 1000,
  };
}

/** Example late minutes for Find Match given check-in offset from session start. */
export function computeLateMinutesForCheckIn(
  checkInOffsetMinutes: number,
  graceMinutes: number
): number {
  return Math.max(0, checkInOffsetMinutes - graceMinutes);
}
