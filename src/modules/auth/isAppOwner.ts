import { APP_OWNER_EMAIL } from '@/config/constants';
import { Session } from '@/types/session';

/** True when signed-in user is the app owner (Admin tab + sponsor settings). */
export function isAppOwner(session: Session | null | undefined): boolean {
  if (!session?.email) return false;
  return session.email.toLowerCase() === APP_OWNER_EMAIL.toLowerCase();
}
