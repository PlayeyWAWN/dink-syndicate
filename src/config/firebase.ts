/**
 * Firebase web config — Phase 2 only.
 * Values injected at build time via Cloudflare env vars.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/** Returns null until Phase 2 Firebase project is wired. */
export function getFirebaseConfig(): FirebaseWebConfig | null {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY as string | undefined;
  if (!apiKey) return null;

  return {
    apiKey,
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN ?? ''),
    projectId: String(env.VITE_FIREBASE_PROJECT_ID ?? ''),
    storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET ?? ''),
    messagingSenderId: String(env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''),
    appId: String(env.VITE_FIREBASE_APP_ID ?? ''),
  };
}

export function isFirebaseEnabled(): boolean {
  return getFirebaseConfig() !== null;
}
