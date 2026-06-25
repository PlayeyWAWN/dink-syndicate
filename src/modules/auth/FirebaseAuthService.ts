import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { DEFAULT_ORGANIZER_NAME } from '@/config/constants';
import { getFirebaseAuth } from '@/config/firebase-app';
import type { AuthProvider } from '@/modules/auth/AuthProvider';
import { Session, SessionSchema, Unsubscribe } from '@/types/session';

function userToSession(user: User): Session {
  return SessionSchema.parse({
    id: user.uid,
    organizerName: user.displayName?.trim() || user.email?.split('@')[0] || DEFAULT_ORGANIZER_NAME,
    role: 'queue_master',
    createdAt: user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : Date.now(),
  });
}

/** Firebase Auth backend — Google + email/password when env vars are configured. */
export class FirebaseAuthService implements AuthProvider {
  private session: Session | null = null;
  private listeners = new Set<(session: Session | null) => void>();
  private authUnsubscribe: Unsubscribe | null = null;

  constructor() {
    const auth = getFirebaseAuth();
    if (!auth) return;

    this.authUnsubscribe = onAuthStateChanged(auth, (user) => {
      this.session = user ? userToSession(user) : null;
      this.emit(this.session);
    });
  }

  getSession(): Session | null {
    return this.session;
  }

  async signIn(): Promise<Session> {
    if (this.session) return this.session;
    throw new Error('Not signed in. Use signInWithGoogle() or signInWithEmail().');
  }

  async signInWithGoogle(): Promise<Session> {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Auth is not configured');

    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    const session = userToSession(result.user);
    this.session = session;
    this.emit(session);
    return session;
  }

  async signInWithEmail(email: string, password: string): Promise<Session> {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Auth is not configured');

    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    const session = userToSession(result.user);
    this.session = session;
    this.emit(session);
    return session;
  }

  async registerWithEmail(email: string, password: string, displayName?: string): Promise<Session> {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase Auth is not configured');

    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const trimmedName = displayName?.trim();
    if (trimmedName) {
      await updateProfile(result.user, { displayName: trimmedName });
    }
    const session = userToSession(result.user);
    this.session = SessionSchema.parse({
      ...session,
      organizerName: trimmedName || session.organizerName,
    });
    this.emit(this.session);
    return this.session;
  }

  async signOut(): Promise<void> {
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
    this.session = null;
    this.emit(null);
  }

  onSessionChange(callback: (session: Session | null) => void): Unsubscribe {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  updateOrganizerName(name: string): Session {
    if (!this.session) throw new Error('No active session');
    const trimmed = name.trim() || DEFAULT_ORGANIZER_NAME;
    this.session = SessionSchema.parse({ ...this.session, organizerName: trimmed });
    this.emit(this.session);
    return this.session;
  }

  dispose(): void {
    this.authUnsubscribe?.();
    this.authUnsubscribe = null;
  }

  private emit(session: Session | null): void {
    for (const listener of this.listeners) {
      listener(session);
    }
  }
}

export const firebaseAuthService = new FirebaseAuthService();
