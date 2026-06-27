import {
  isLiveSessionActive,
  isLiveSessionStale,
} from '@/modules/live/live-session-expiry';
import { LiveSessionSnapshot, LIVE_SESSION_STALE_THRESHOLD_MS } from '@/types/live';

function session(overrides: Partial<LiveSessionSnapshot> = {}): LiveSessionSnapshot {
  return {
    sessionId: 's1',
    organizerName: 'Test Org',
    publishToken: 'tok',
    isActive: true,
    updatedAt: Date.now(),
    gameMode: 'dupr_open_play',
    courts: [],
    activeMatches: [],
    queueNext: [],
    completedMatches: [],
    rankings: [],
    rankingDeltas: {},
    players: [],
    viewerStats: {
      totalUnique: 0,
      peakConcurrent: 0,
      totalViewMinutes: 0,
      publishStartedAt: Date.now(),
    },
    ...overrides,
  };
}

describe('isLiveSessionActive', () => {
  it('returns false for null or inactive sessions', () => {
    expect(isLiveSessionActive(null)).toBe(false);
    expect(isLiveSessionActive(session({ isActive: false }))).toBe(false);
  });

  it('returns true when recently synced', () => {
    const now = Date.now();
    expect(isLiveSessionActive(session({ updatedAt: now - 60_000 }), now)).toBe(true);
  });

  it('returns false when the snapshot has not been synced recently', () => {
    const now = Date.now();
    const staleAt = now - LIVE_SESSION_STALE_THRESHOLD_MS - 1;
    expect(isLiveSessionActive(session({ updatedAt: staleAt }), now)).toBe(false);
  });
});

describe('isLiveSessionStale', () => {
  it('returns false for inactive sessions', () => {
    expect(isLiveSessionStale(session({ isActive: false }))).toBe(false);
  });

  it('returns true when active but not synced recently', () => {
    const now = Date.now();
    const staleAt = now - LIVE_SESSION_STALE_THRESHOLD_MS - 1;
    expect(isLiveSessionStale(session({ updatedAt: staleAt }), now)).toBe(true);
  });
});
