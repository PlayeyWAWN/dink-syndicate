import {
  collection,
  doc,
  increment,
  runTransaction,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/config/firebase-app';
import { isFirebaseEnabled } from '@/config/firebase';
import { FIRESTORE_PATHS, todayDateKey } from '@/modules/live/firestore-paths';
import { AdminDailyRollup, WallboardDailyRollup } from '@/types/analytics';

function getDb(): Firestore | null {
  if (!isFirebaseEnabled()) return null;
  return getFirebaseFirestore();
}

export async function incrementAdminDailyField(
  field: keyof Pick<
    AdminDailyRollup,
    'mainAppPageViews' | 'wallboardPageViews' | 'newSignUps' | 'uniqueActiveUsers' | 'publishSessionsStarted'
  >,
  amount = 1
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const date = todayDateKey();
  const ref = doc(db, FIRESTORE_PATHS.adminDaily(date));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, {
        date,
        mainAppPageViews: field === 'mainAppPageViews' ? amount : 0,
        wallboardPageViews: field === 'wallboardPageViews' ? amount : 0,
        newSignUps: field === 'newSignUps' ? amount : 0,
        uniqueActiveUsers: field === 'uniqueActiveUsers' ? amount : 0,
        publishSessionsStarted: field === 'publishSessionsStarted' ? amount : 0,
        updatedAt: Date.now(),
      });
      return;
    }
    tx.update(ref, {
      [field]: increment(amount),
      updatedAt: Date.now(),
    });
  });
}

export async function incrementWallboardDailyField(
  field: keyof Pick<
    WallboardDailyRollup,
    'totalUniqueViewers' | 'peakConcurrent' | 'totalViewMinutes' | 'sessionsPublished'
  >,
  amount = 1
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const date = todayDateKey();
  const ref = doc(db, FIRESTORE_PATHS.wallboardDaily(date));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, {
        date,
        totalUniqueViewers: field === 'totalUniqueViewers' ? amount : 0,
        peakConcurrent: field === 'peakConcurrent' ? amount : 0,
        totalViewMinutes: field === 'totalViewMinutes' ? amount : 0,
        sessionsPublished: field === 'sessionsPublished' ? amount : 0,
        updatedAt: Date.now(),
      });
      return;
    }
    tx.update(ref, {
      [field]: increment(amount),
      updatedAt: Date.now(),
    });
  });
}

export async function upsertDoc<T extends Record<string, unknown>>(
  path: string,
  data: T,
  merge = true
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await setDoc(doc(db, path), data, { merge });
}

export async function updateDocFields(path: string, data: Record<string, unknown>): Promise<void> {
  const db = getDb();
  if (!db) return;
  await updateDoc(doc(db, path), data);
}

export { collection, doc, getDb as getFirestoreDb };
