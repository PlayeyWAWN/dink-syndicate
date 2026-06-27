import { LiveSessionSnapshot, LIVE_SESSION_STALE_THRESHOLD_MS } from '@/types/live';

/** True when a session should still be treated as live (published and recently synced). */
export function isLiveSessionActive(
  snapshot: LiveSessionSnapshot | null | undefined,
  now = Date.now()
): snapshot is LiveSessionSnapshot {
  if (!snapshot?.isActive) return false;
  return now - snapshot.updatedAt <= LIVE_SESSION_STALE_THRESHOLD_MS;
}

export function isLiveSessionStale(
  snapshot: LiveSessionSnapshot | null | undefined,
  now = Date.now()
): boolean {
  if (!snapshot?.isActive) return false;
  return now - snapshot.updatedAt > LIVE_SESSION_STALE_THRESHOLD_MS;
}
