import { isFirebaseEnabled } from '@/config/firebase';
import { getAuthService } from '@/modules/auth/getAuthService';
import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { Session } from '@/types/session';
import { mountAuthOverlay, AuthOverlayController } from '@/ui/components/AuthOverlay';

let authOverlay: AuthOverlayController | null = null;

async function hydrateStoresForSession(session: Session): Promise<void> {
  await useSessionStore.getState().activateSession(session);
  const snapshot = useSessionStore.getState().loadSnapshot();
  usePlayerStore.getState().hydrate();
  useCourtStore.getState().hydrate();
  useQueueStore.getState().hydrate();
  useQueueUiStore.getState().hydrateFromSettings(snapshot?.settings);
}

/**
 * When Firebase is configured, show login overlay until the user signs in.
 * Keeps listening for sign-out and re-shows the overlay.
 */
export async function runFirebaseAuthGate(onAuthenticated: () => void): Promise<void> {
  if (!isFirebaseEnabled()) return;

  authOverlay = mountAuthOverlay();
  authOverlay.show();

  const auth = getAuthService();

  await new Promise<void>((resolve) => {
    let initial = true;

    auth.onSessionChange(async (session) => {
      if (session) {
        authOverlay?.hide();
        await hydrateStoresForSession(session);
        onAuthenticated();
      } else {
        useSessionStore.getState().clearSession();
        authOverlay?.show();
      }

      if (initial) {
        initial = false;
        resolve();
      }
    });
  });
}

export function showAuthOverlay(): void {
  authOverlay?.show();
}
