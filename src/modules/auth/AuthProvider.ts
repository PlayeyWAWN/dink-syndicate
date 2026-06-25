import type { Session, Unsubscribe } from '@/types/session';

/** Auth backend contract — LocalSessionService (Phase 1) or FirebaseAuthService (Phase 2). */
export interface AuthProvider {
  getSession(): Session | null;
  signIn(): Promise<Session>;
  signOut(): Promise<void>;
  onSessionChange(callback: (session: Session | null) => void): Unsubscribe;
  updateOrganizerName(name: string): Session;
}
