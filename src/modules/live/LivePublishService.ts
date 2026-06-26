import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { isFirebaseEnabled } from '@/config/firebase';
import { getFirebaseFirestore } from '@/config/firebase-app';
import { buildLiveSnapshot } from '@/modules/live/buildLiveSnapshot';
import {
  buildLiveWallboardUrl,
  FIRESTORE_PATHS,
  generatePublishToken,
  todayDateKey,
} from '@/modules/live/firestore-paths';
import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useSessionStore } from '@/stores/sessionStore';
import { LiveSessionSnapshot, PublicRankingRow, VIEWER_ACTIVE_THRESHOLD_MS } from '@/types/live';
import { WallboardDailyRollup } from '@/types/analytics';
import {
  mergeWallboardDailyRollup as mergeWallboardRollupStats,
  emptyWallboardDailyRollup,
} from '@/modules/live/wallboard-rollup';
import { appAnalyticsService } from '@/modules/analytics/AppAnalyticsService';

const SYNC_DEBOUNCE_MS = 500;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let previousRankings: PublicRankingRow[] | null = null;
let lastSyncedAt: number | null = null;
let viewerUnsubscribe: Unsubscribe | null = null;
let viewerCountCallback: ((count: number) => void) | null = null;

function getDb() {
  if (!isFirebaseEnabled()) return null;
  return getFirebaseFirestore();
}

function getOrganizerName(): string {
  const snapshot = useSessionStore.getState().loadSnapshot();
  return (
    snapshot?.settings?.organizerName ??
    useSessionStore.getState().session?.organizerName ??
    'Queue Master'
  );
}

function defaultViewerStats(): LiveSessionSnapshot['viewerStats'] {
  return {
    totalUnique: 0,
    peakConcurrent: 0,
    totalViewMinutes: 0,
    publishStartedAt: Date.now(),
  };
}

async function persistWallboardDailyRollup(stats: LiveSessionSnapshot['viewerStats']): Promise<void> {
  const db = getDb();
  if (!db) return;

  const date = todayDateKey();
  const ref = doc(db, FIRESTORE_PATHS.wallboardDaily(date));
  const existing = await getDoc(ref);
  const prev = existing.exists()
    ? (existing.data() as WallboardDailyRollup)
    : emptyWallboardDailyRollup(date);

  await setDoc(ref, mergeWallboardRollupStats(prev, stats));
}

async function cleanupViewerDocs(token: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const viewersRef = collection(db, FIRESTORE_PATHS.liveSessionViewers(token));
  const snap = await getDocs(viewersRef);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

export const livePublishService = {
  getLastSyncedAt(): number | null {
    return lastSyncedAt;
  },

  buildWallboardUrl(token: string): string {
    return buildLiveWallboardUrl(token);
  },

  isPublishEnabled(): boolean {
    return useSessionStore.getState().session?.publishEnabled === true;
  },

  getPublishToken(): string | undefined {
    return useSessionStore.getState().session?.publishToken;
  },

  async enablePublish(): Promise<{ ok: true; token: string; url: string } | { ok: false; message: string }> {
    const db = getDb();
    const session = useSessionStore.getState().session;
    if (!db || !session) {
      return { ok: false, message: 'Sign in with Firebase to publish a live wallboard.' };
    }

    const token = generatePublishToken();
    previousRankings = null;

    useSessionStore.getState().persistSnapshot({
      session: {
        ...session,
        publishToken: token,
        publishEnabled: true,
      },
    });

    const viewerStats = defaultViewerStats();
    const snapshot = buildLiveSnapshot({
      sessionId: session.id,
      organizerName: getOrganizerName(),
      publishToken: token,
      isActive: true,
      settings: useSessionStore.getState().loadSnapshot()?.settings,
      courts: useCourtStore.getState().courts,
      queueState: useQueueStore.getState().queueState,
      players: usePlayerStore.getState().players,
      viewerStats,
    });

    await setDoc(doc(db, FIRESTORE_PATHS.liveSession(token)), snapshot);
    lastSyncedAt = Date.now();

    await appAnalyticsService.setPublishEnabled(true);
    await appAnalyticsService.incrementPublishSessionsStarted();

    return { ok: true, token, url: buildLiveWallboardUrl(token) };
  },

  async disablePublish(): Promise<void> {
    const db = getDb();
    const session = useSessionStore.getState().session;
    const token = session?.publishToken;
    if (!session) return;

    if (db && token) {
      const ref = doc(db, FIRESTORE_PATHS.liveSession(token));
      const existing = await getDoc(ref);
      if (existing.exists()) {
        const data = existing.data() as LiveSessionSnapshot;
        await persistWallboardDailyRollup(data.viewerStats);
        await updateDoc(ref, { isActive: false, updatedAt: Date.now() });
        await cleanupViewerDocs(token);
      }
    }

    useSessionStore.getState().persistSnapshot({
      session: {
        ...session,
        publishEnabled: false,
        publishToken: undefined,
      },
    });

    previousRankings = null;
    this.stopViewerListener();
    await appAnalyticsService.setPublishEnabled(false);
  },

  async regenerateToken(): Promise<{ ok: true; token: string; url: string } | { ok: false; message: string }> {
    await this.disablePublish();
    return this.enablePublish();
  },

  scheduleSync(): void {
    if (!this.isPublishEnabled()) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      void this.syncSnapshot();
    }, SYNC_DEBOUNCE_MS);
  },

  async syncSnapshot(): Promise<void> {
    const db = getDb();
    const session = useSessionStore.getState().session;
    const token = session?.publishToken;
    if (!db || !session || !token || !session.publishEnabled) return;

    const ref = doc(db, FIRESTORE_PATHS.liveSession(token));
    const existing = await getDoc(ref);
    const existingData = existing.exists() ? (existing.data() as LiveSessionSnapshot) : null;
    const viewerStats = existingData?.viewerStats ?? defaultViewerStats();

    const snapshot = buildLiveSnapshot({
      sessionId: session.id,
      organizerName: getOrganizerName(),
      publishToken: token,
      isActive: true,
      settings: useSessionStore.getState().loadSnapshot()?.settings,
      courts: useCourtStore.getState().courts,
      queueState: useQueueStore.getState().queueState,
      players: usePlayerStore.getState().players,
      previousRankings: previousRankings ?? existingData?.rankings,
      viewerStats,
    });

    previousRankings = snapshot.rankings;
    await setDoc(ref, snapshot);
    lastSyncedAt = Date.now();
  },

  subscribeViewerCount(token: string, callback: (count: number) => void): Unsubscribe {
    this.stopViewerListener();
    viewerCountCallback = callback;

    const db = getDb();
    if (!db) {
      callback(0);
      return () => undefined;
    }

    const threshold = Date.now() - VIEWER_ACTIVE_THRESHOLD_MS;
    const viewersRef = collection(db, FIRESTORE_PATHS.liveSessionViewers(token));
    const q = query(viewersRef, where('lastSeen', '>', threshold));

    viewerUnsubscribe = onSnapshot(q, (snap) => {
      const count = snap.size;
      callback(count);
      void this.maybeUpdatePeakConcurrent(token, count);
    });

    return () => this.stopViewerListener();
  },

  stopViewerListener(): void {
    viewerUnsubscribe?.();
    viewerUnsubscribe = null;
    viewerCountCallback = null;
  },

  async maybeUpdatePeakConcurrent(token: string, count: number): Promise<void> {
    const db = getDb();
    if (!db || count <= 0) return;

    const ref = doc(db, FIRESTORE_PATHS.liveSession(token));
    const existing = await getDoc(ref);
    if (!existing.exists()) return;

    const data = existing.data() as LiveSessionSnapshot;
    if (count > data.viewerStats.peakConcurrent) {
      await updateDoc(ref, {
        'viewerStats.peakConcurrent': count,
        updatedAt: Date.now(),
      });
    }
  },
};

/** Hook after queue persist — debounced Firestore sync when publish is on. */
export function notifyQueuePersisted(): void {
  livePublishService.scheduleSync();
}
