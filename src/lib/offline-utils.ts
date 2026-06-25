import {
  applyServiceWorkerVersionUpgrade,
  refreshDinkSyndicateApp,
} from '@/lib/version-check';

function activateWaitingWorker(registration: ServiceWorkerRegistration, reason: string): void {
  if (!registration.waiting) return;
  console.info('[Dink] Activating waiting service worker', { reason });
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => refreshDinkSyndicateApp(reason), 500);
}

function listenForServiceWorkerMessages(): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data as { type?: string; newVersion?: string } | null;
    if (data?.type !== 'VERSION_UPDATED' || !data.newVersion) return;
    console.info('[Dink] Service worker reported version update', data.newVersion);
    applyServiceWorkerVersionUpgrade(data.newVersion);
  });
}

/** Register service worker and auto-activate updates (immediate reload on new version). */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  listenForServiceWorkerMessages();

  try {
    const hadControllerBefore = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    await registration.update();

    if (registration.waiting) {
      activateWaitingWorker(registration, 'sw-waiting-activated');
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }

        if (newWorker.state === 'activated' && hadControllerBefore) {
          refreshDinkSyndicateApp('sw-new-worker-activated');
        }
      });
    });

    return registration;
  } catch (error) {
    console.warn('[Dink] Service worker registration failed', error);
    return null;
  }
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
