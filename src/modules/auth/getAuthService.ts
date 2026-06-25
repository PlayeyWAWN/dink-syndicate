import type { AuthProvider } from '@/modules/auth/AuthProvider';
import { firebaseAuthService, FirebaseAuthService } from '@/modules/auth/FirebaseAuthService';
import { localSessionService } from '@/modules/auth/LocalSessionService';
import { isFirebaseEnabled } from '@/config/firebase';

/** Local session when Firebase env is absent; Firebase Auth when configured. */
export function getAuthService(): AuthProvider {
  return isFirebaseEnabled() ? firebaseAuthService : localSessionService;
}

/** Firebase-only auth helpers (Google popup, email register). */
export function getFirebaseAuthService(): FirebaseAuthService | null {
  return isFirebaseEnabled() ? firebaseAuthService : null;
}
