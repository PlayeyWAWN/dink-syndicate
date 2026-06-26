import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { isFirebaseEnabled } from '@/config/firebase';
import { getFirebaseAuth, getFirebaseFirestore } from '@/config/firebase-app';
import { deriveOrganizerName } from '@/modules/auth/deriveOrganizerName';
import { incrementAdminDailyField } from '@/modules/analytics/firestore-analytics';
import { FIRESTORE_PATHS, todayDateKey } from '@/modules/live/firestore-paths';
import { useSessionStore } from '@/stores/sessionStore';
import { UserProfile } from '@/types/analytics';
import { PRESENCE_HEARTBEAT_MS } from '@/types/live';
import { appRouter } from '@/app/router';

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const pageViewDebounce = new Map<string, number>();
const PAGE_VIEW_DEBOUNCE_MS = 5 * 60 * 1000;

function authProviderFromUser(user: User | null): UserProfile['authProvider'] {
  if (!user) return 'unknown';
  const provider = user.providerData[0]?.providerId ?? '';
  if (provider.includes('google')) return 'google';
  if (provider.includes('password')) return 'password';
  return 'unknown';
}

export const appAnalyticsService = {
  async onAuthSession(session: { id: string; email?: string; organizerName: string }): Promise<void> {
    if (!isFirebaseEnabled()) return;

    const auth = getFirebaseAuth();
    const db = getFirebaseFirestore();
    const user = auth?.currentUser;
    if (!db || !user) return;

    const ref = doc(db, FIRESTORE_PATHS.userProfile(user.uid));
    const existing = await getDoc(ref);
    const now = Date.now();
    const organizerName =
      session.organizerName ||
      deriveOrganizerName({ displayName: user.displayName, email: user.email });

    const profile: UserProfile = {
      uid: user.uid,
      email: user.email ?? session.email ?? '',
      createdAt: existing.exists()
        ? (existing.data() as UserProfile).createdAt
        : now,
      lastSeenAt: now,
      lastRoute: appRouter.getRoute(),
      authProvider: authProviderFromUser(user),
      emailVerified: user.emailVerified,
      organizerName,
      publishEnabled: existing.exists()
        ? (existing.data() as UserProfile).publishEnabled
        : false,
      countedActiveToday: existing.exists()
        ? (existing.data() as UserProfile).countedActiveToday
        : undefined,
    };

    await setDoc(ref, profile, { merge: true });

    if (!existing.exists()) {
      await incrementAdminDailyField('newSignUps');
    }

    await this.markUniqueActiveToday(user.uid, profile);
    this.startHeartbeat();
  },

  async markUniqueActiveToday(uid: string, profile: UserProfile): Promise<void> {
    const today = todayDateKey();
    if (profile.countedActiveToday === today) return;

    const db = getFirebaseFirestore();
    if (!db) return;

    await setDoc(
      doc(db, FIRESTORE_PATHS.userProfile(uid)),
      { countedActiveToday: today },
      { merge: true }
    );
    await incrementAdminDailyField('uniqueActiveUsers');
  },

  startHeartbeat(): void {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      void this.heartbeat();
    }, PRESENCE_HEARTBEAT_MS);
  },

  stopHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  },

  async heartbeat(): Promise<void> {
    if (!isFirebaseEnabled()) return;

    const auth = getFirebaseAuth();
    const db = getFirebaseFirestore();
    const user = auth?.currentUser;
    const session = useSessionStore.getState().session;
    if (!db || !user || !session) return;

    const snapshot = useSessionStore.getState().loadSnapshot();
    const organizerName =
      snapshot?.settings?.organizerName ??
      session.organizerName ??
      deriveOrganizerName({ displayName: user.displayName, email: user.email });

    await setDoc(
      doc(db, FIRESTORE_PATHS.userProfile(user.uid)),
      {
        lastSeenAt: Date.now(),
        lastRoute: appRouter.getRoute(),
        organizerName,
        emailVerified: user.emailVerified,
        publishEnabled: session.publishEnabled === true,
      },
      { merge: true }
    );
  },

  async onRouteChange(route: string): Promise<void> {
    if (!isFirebaseEnabled()) return;

    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) return;

    const key = `${user.uid}:${route}`;
    const now = Date.now();
    const last = pageViewDebounce.get(key) ?? 0;
    if (now - last >= PAGE_VIEW_DEBOUNCE_MS) {
      pageViewDebounce.set(key, now);
      await incrementAdminDailyField('mainAppPageViews');
    }

    await this.heartbeat();
  },

  async recordWallboardPageView(): Promise<void> {
    await incrementAdminDailyField('wallboardPageViews');
  },

  async setPublishEnabled(enabled: boolean): Promise<void> {
    if (!isFirebaseEnabled()) return;
    const auth = getFirebaseAuth();
    const db = getFirebaseFirestore();
    const user = auth?.currentUser;
    if (!db || !user) return;

    await setDoc(
      doc(db, FIRESTORE_PATHS.userProfile(user.uid)),
      { publishEnabled: enabled },
      { merge: true }
    );
  },

  async incrementPublishSessionsStarted(): Promise<void> {
    await incrementAdminDailyField('publishSessionsStarted');
  },

  async onSignOut(): Promise<void> {
    this.stopHeartbeat();
  },
};
