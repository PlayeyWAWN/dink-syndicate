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
import { stripUndefinedDeep } from '@/lib/firestore-sanitize';
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
import { useQueueUiStore } from '@/stores/queueUiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { isRotationPaused } from '@/types/queue';
import {
  LiveSessionSnapshot,
  LIVE_PUBLISH_HEARTBEAT_MS,
  PublicRankingRow,
  VIEWER_ACTIVE_THRESHOLD_MS,
} from '@/types/live';
import { WallboardDailyRollup } from '@/types/analytics';
import {
  mergeWallboardDailyRollup as mergeWallboardRollupStats,
  emptyWallboardDailyRollup,
} from '@/modules/live/wallboard-rollup';
import { appAnalyticsService } from '@/modules/analytics/AppAnalyticsService';

const SYNC_DEBOUNCE_MS = 500;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let publishHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let previousRankings: PublicRankingRow[] | null = null;
let lastSyncedAt: number | null = null;
let viewerUnsubscribe: Unsubscribe | null = null;
let viewerCountCallback: ((count: number) => void) | null = null;

function getDb() {
  if (!isFirebaseEnabled()) return null;
  return getFirebaseFirestore();
}

async function writeLiveSession(token: string, snapshot: LiveSessionSnapshot): Promise<void> {
  const db = getDb();
  if (!db) return;

  await setDoc(
    doc(db, FIRESTORE_PATHS.liveSession(token)),
    stripUndefinedDeep(snapshot)
  );
  lastSyncedAt = Date.now();
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

async function deactivateLiveSession(token: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const ref = doc(db, FIRESTORE_PATHS.liveSession(token));
  const existing = await getDoc(ref);
  if (!existing.exists()) return;

  const data = existing.data() as LiveSessionSnapshot;
  if (!data.isActive) return;

  await persistWallboardDailyRollup(data.viewerStats);
  await updateDoc(ref, { isActive: false, updatedAt: Date.now() });
  await cleanupViewerDocs(token);
}

function startPublishHeartbeat(): void {
  if (publishHeartbeatTimer) return;
  publishHeartbeatTimer = setInterval(() => {
    void livePublishService.syncSnapshot();
  }, LIVE_PUBLISH_HEARTBEAT_MS);
}

function stopPublishHeartbeat(): void {
  if (!publishHeartbeatTimer) return;
  clearInterval(publishHeartbeatTimer);
  publishHeartbeatTimer = null;
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

    try {
      await writeLiveSession(token, snapshot);
    } catch (error) {
      console.error('[LivePublish] Failed to publish wallboard snapshot', error);
      return { ok: false, message: 'Could not publish to Firestore. Check the console for details.' };
    }

    await appAnalyticsService.setPublishEnabled(true);
    await appAnalyticsService.incrementPublishSessionsStarted();
    startPublishHeartbeat();

    return { ok: true, token, url: buildLiveWallboardUrl(token) };
  },

  async disablePublish(): Promise<void> {
    const session = useSessionStore.getState().session;
    const token = session?.publishToken;
    if (!session) return;

    stopPublishHeartbeat();

    if (token) {
      await deactivateLiveSession(token);
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

  /** Resume heartbeat + sync when publish was left enabled (e.g. after reload). */
  ensurePublishing(): void {
    if (!this.isPublishEnabled()) return;
    startPublishHeartbeat();
    void this.syncSnapshot();
  },

  async expireStaleSession(token: string): Promise<void> {
    await deactivateLiveSession(token);
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

    const queueState = useQueueStore.getState().queueState;
    const stackSelectedPlayerIds = isRotationPaused(queueState)
      ? useQueueUiStore.getState().stackSelectedPlayerIds
      : undefined;

    const snapshot = buildLiveSnapshot({
      sessionId: session.id,
      organizerName: getOrganizerName(),
      publishToken: token,
      isActive: true,
      settings: useSessionStore.getState().loadSnapshot()?.settings,
      courts: useCourtStore.getState().courts,
      queueState,
      players: usePlayerStore.getState().players,
      previousRankings: previousRankings ?? existingData?.rankings,
      viewerStats,
      stackSelectedPlayerIds,
    });

    previousRankings = snapshot.rankings;
    try {
      await writeLiveSession(token, snapshot);
    } catch (error) {
      console.error('[LivePublish] Failed to sync wallboard snapshot', error);
    }
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
      });
    }
  },
};

/** Hook after queue persist — debounced Firestore sync when publish is on. */
export function notifyQueuePersisted(): void {
  livePublishService.scheduleSync();
}
