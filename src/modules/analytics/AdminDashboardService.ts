import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/config/firebase-app';
import { isFirebaseEnabled } from '@/config/firebase';
import { deriveOrganizerName } from '@/modules/auth/deriveOrganizerName';
import { FIRESTORE_PATHS, todayDateKey } from '@/modules/live/firestore-paths';
import { subscribeActiveViewerCount } from '@/modules/live/WallboardViewerPresenceService';
import { AdminDailyRollup, UserProfile, WallboardDailyRollup } from '@/types/analytics';
import { LiveSessionSnapshot, ONLINE_USER_THRESHOLD_MS } from '@/types/live';

export interface AdminDashboardCallbacks {
  onOnlineUsers: (users: UserProfile[]) => void;
  onAllUsers: (users: UserProfile[]) => void;
  onLiveSessions: (sessions: LiveSessionSnapshot[]) => void;
  onViewerCounts: (countsByToken: Record<string, number>) => void;
  onTodayRollup: (rollup: AdminDailyRollup | null) => void;
  onWallboardRollup: (rollup: WallboardDailyRollup | null) => void;
}

function normalizeProfile(raw: Record<string, unknown>): UserProfile {
  const email = String(raw.email ?? '');
  return {
    uid: String(raw.uid ?? ''),
    email,
    createdAt: Number(raw.createdAt ?? Date.now()),
    lastSeenAt: Number(raw.lastSeenAt ?? 0),
    lastRoute: String(raw.lastRoute ?? 'home'),
    authProvider: (raw.authProvider as UserProfile['authProvider']) ?? 'unknown',
    emailVerified: Boolean(raw.emailVerified),
    organizerName:
      String(raw.organizerName ?? '').trim() ||
      deriveOrganizerName({ email }),
    publishEnabled: raw.publishEnabled === true,
    countedActiveToday: raw.countedActiveToday as string | undefined,
  };
}

export function subscribeAdminDashboard(callbacks: AdminDashboardCallbacks): Unsubscribe {
  if (!isFirebaseEnabled()) {
    callbacks.onOnlineUsers([]);
    callbacks.onAllUsers([]);
    callbacks.onLiveSessions([]);
    callbacks.onViewerCounts({});
    callbacks.onTodayRollup(null);
    callbacks.onWallboardRollup(null);
    return () => undefined;
  }

  const db = getFirebaseFirestore();
  if (!db) return () => undefined;

  const unsubs: Unsubscribe[] = [];
  const viewerUnsubs = new Map<string, Unsubscribe>();
  let liveTokens: string[] = [];

  const updateViewerSubscriptions = (sessions: LiveSessionSnapshot[]): void => {
    const tokens = sessions.filter((s) => s.isActive).map((s) => s.publishToken);
    const counts: Record<string, number> = {};

    for (const token of liveTokens) {
      if (!tokens.includes(token)) {
        viewerUnsubs.get(token)?.();
        viewerUnsubs.delete(token);
      }
    }

    liveTokens = tokens;

    for (const token of tokens) {
      if (viewerUnsubs.has(token)) continue;
      const unsub = subscribeActiveViewerCount(token, (count) => {
        counts[token] = count;
        callbacks.onViewerCounts({ ...counts });
      });
      viewerUnsubs.set(token, unsub);
    }

    if (tokens.length === 0) {
      callbacks.onViewerCounts({});
    }
  };

  unsubs.push(
    onSnapshot(collection(db, 'userProfiles'), (snap) => {
      const all = snap.docs.map((d) => normalizeProfile(d.data() as Record<string, unknown>));
      const threshold = Date.now() - ONLINE_USER_THRESHOLD_MS;
      const online = all
        .filter((u) => u.lastSeenAt >= threshold)
        .sort((a, b) => a.organizerName.localeCompare(b.organizerName));

      callbacks.onAllUsers(all);
      callbacks.onOnlineUsers(online);
    })
  );

  unsubs.push(
    onSnapshot(query(collection(db, 'liveSessions'), where('isActive', '==', true)), (snap) => {
      const sessions = snap.docs.map((d) => d.data() as LiveSessionSnapshot);
      callbacks.onLiveSessions(sessions);
      updateViewerSubscriptions(sessions);
    })
  );

  const today = todayDateKey();
  unsubs.push(
    onSnapshot(doc(db, FIRESTORE_PATHS.adminDaily(today)), (snap) => {
      callbacks.onTodayRollup(
        snap.exists() ? (snap.data() as AdminDailyRollup) : null
      );
    })
  );

  unsubs.push(
    onSnapshot(doc(db, FIRESTORE_PATHS.wallboardDaily(today)), (snap) => {
      callbacks.onWallboardRollup(
        snap.exists() ? (snap.data() as WallboardDailyRollup) : null
      );
    })
  );

  return () => {
    for (const unsub of unsubs) unsub();
    for (const unsub of viewerUnsubs.values()) unsub();
    viewerUnsubs.clear();
  };
}

export async function fetchAdminDailyRange(days: number): Promise<AdminDailyRollup[]> {
  const db = getFirebaseFirestore();
  if (!db || !isFirebaseEnabled()) return [];

  const results: AdminDailyRollup[] = [];
  const now = Date.now();

  for (let i = 0; i < days; i += 1) {
    const date = todayDateKey(now - i * 86_400_000);
    const snap = await getDocs(collection(db, 'adminAnalytics/daily'));
    const match = snap.docs.find((d) => d.id === date);
    if (match?.exists()) {
      results.push(match.data() as AdminDailyRollup);
    }
  }

  return results.sort((a, b) => b.date.localeCompare(a.date));
}
