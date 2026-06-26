/** Firestore collection and document path helpers. */
export const FIRESTORE_PATHS = {
  liveSession: (token: string) => `liveSessions/${token}`,
  liveSessionViewers: (token: string) => `liveSessions/${token}/viewers`,
  liveSessionViewer: (token: string, viewerId: string) =>
    `liveSessions/${token}/viewers/${viewerId}`,
  appConfigGlobal: 'appConfig/global',
  userProfile: (uid: string) => `userProfiles/${uid}`,
  adminDaily: (date: string) => `adminAnalytics/daily/${date}`,
  wallboardDaily: (date: string) => `wallboardAnalytics/daily/${date}`,
} as const;

export function todayDateKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function generatePublishToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildLiveWallboardUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://dinksyndicate.com';
  return `${base}/live/${token}`;
}
