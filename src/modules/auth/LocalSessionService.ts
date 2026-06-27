import { DEFAULT_ORGANIZER_NAME, STORAGE_KEYS } from '@/config/constants';
import { normalizeOrganizerName } from '@/modules/auth/deriveOrganizerName';
import type { AuthProvider } from '@/modules/auth/AuthProvider';
import { Session, SessionSchema, Unsubscribe } from '@/types/session';

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredSession(): Session | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try {
    return SessionSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
}

/** Phase 1 device-scoped session — no login screen, no Firebase. */
export class LocalSessionService implements AuthProvider {
  private session: Session | null = readStoredSession();
  private listeners = new Set<(session: Session | null) => void>();

  getSession(): Session | null {
    return this.session;
  }

  async signIn(): Promise<Session> {
    if (this.session) return this.session;

    const session = SessionSchema.parse({
      id: createSessionId(),
      organizerName: DEFAULT_ORGANIZER_NAME,
      role: 'queue_master',
      createdAt: Date.now(),
    });

    this.session = session;
    writeStoredSession(session);
    this.emit(session);
    return session;
  }

  async signOut(): Promise<void> {
    this.session = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
    this.emit(null);
  }

  onSessionChange(callback: (session: Session | null) => void): Unsubscribe {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  updateOrganizerName(name: string): Session {
    if (!this.session) {
      throw new Error('No active session');
    }
    const trimmed = normalizeOrganizerName(name);
    this.session = SessionSchema.parse({
      ...this.session,
      organizerName: trimmed,
    });
    writeStoredSession(this.session);
    this.emit(this.session);
    return this.session;
  }

  private emit(session: Session | null): void {
    for (const listener of this.listeners) {
      listener(session);
    }
  }
}

export const localSessionService = new LocalSessionService();
