import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/config/firebase-app';
import { isFirebaseEnabled } from '@/config/firebase';
import { FIRESTORE_PATHS } from '@/modules/live/firestore-paths';
import { incrementAdminDailyField } from '@/modules/analytics/firestore-analytics';
import { VIEWER_ACTIVE_THRESHOLD_MS } from '@/types/live';

const VIEWER_STORAGE_KEY = 'dinksyndicate_wallboard_viewer_id';

function getOrCreateViewerId(): string {
  const existing = sessionStorage.getItem(VIEWER_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(VIEWER_STORAGE_KEY, id);
  return id;
}

export interface WallboardPresenceHandle {
  stop: () => void;
}

/** Anonymous viewer heartbeat for live wallboard audience tracking. */
export function startWallboardViewerPresence(token: string): WallboardPresenceHandle {
  if (!isFirebaseEnabled()) {
    return { stop: () => undefined };
  }

  const db = getFirebaseFirestore();
  if (!db) return { stop: () => undefined };

  const viewerId = getOrCreateViewerId();
  const viewerRef = doc(db, FIRESTORE_PATHS.liveSessionViewer(token, viewerId));
  const sessionRef = doc(db, FIRESTORE_PATHS.liveSession(token));
  const now = Date.now();
  let firstSeen = now;
  let stopped = false;

  void runTransaction(db, async (tx) => {
    const viewerSnap = await tx.get(viewerRef);
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists()) return;

    if (!viewerSnap.exists()) {
      tx.set(viewerRef, { firstSeen: now, lastSeen: now });
      tx.update(sessionRef, {
        'viewerStats.totalUnique': (sessionSnap.data().viewerStats?.totalUnique ?? 0) + 1,
        updatedAt: now,
      });
      firstSeen = now;
    } else {
      firstSeen = viewerSnap.data().firstSeen ?? now;
      tx.update(viewerRef, { lastSeen: now });
    }
  });

  void incrementAdminDailyField('wallboardPageViews');

  const heartbeat = setInterval(() => {
    if (stopped) return;
    void setDoc(viewerRef, { firstSeen, lastSeen: Date.now() }, { merge: true });
  }, 30_000);

  const finalize = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    clearInterval(heartbeat);

    try {
      const viewerSnap = await getDoc(viewerRef);
      if (viewerSnap.exists()) {
        const data = viewerSnap.data();
        const minutes = Math.max(1, Math.ceil((Date.now() - (data.firstSeen ?? now)) / 60_000));
        await runTransaction(db, async (tx) => {
          const sessionSnap = await tx.get(sessionRef);
          if (sessionSnap.exists()) {
            tx.update(sessionRef, {
              'viewerStats.totalViewMinutes': incrementViewMinutes(
                sessionSnap.data().viewerStats?.totalViewMinutes ?? 0,
                minutes
              ),
              updatedAt: Date.now(),
            });
          }
        });
      }
      await deleteDoc(viewerRef);
    } catch {
      // best-effort cleanup
    }
  };

  const onHide = (): void => {
    if (document.visibilityState === 'hidden') void finalize();
  };

  window.addEventListener('pagehide', () => void finalize());
  window.addEventListener('beforeunload', () => void finalize());
  document.addEventListener('visibilitychange', onHide);

  return {
    stop: () => {
      void finalize();
      window.removeEventListener('pagehide', () => void finalize());
      window.removeEventListener('beforeunload', () => void finalize());
      document.removeEventListener('visibilitychange', onHide);
    },
  };
}

function incrementViewMinutes(current: number, added: number): number {
  return current + added;
}

export function subscribeActiveViewerCount(
  token: string,
  callback: (count: number) => void
): Unsubscribe {
  const db = getFirebaseFirestore();
  if (!db || !isFirebaseEnabled()) {
    callback(0);
    return () => undefined;
  }

  const threshold = Date.now() - VIEWER_ACTIVE_THRESHOLD_MS;
  const q = query(
    collection(db, FIRESTORE_PATHS.liveSessionViewers(token)),
    where('lastSeen', '>', threshold)
  );

  return onSnapshot(q, (snap) => callback(snap.size));
}
