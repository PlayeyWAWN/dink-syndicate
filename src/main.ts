import '../css/index.css';
import { bootstrapApp } from '@/app/bootstrap';
import { bootstrapLiveWallboard, parseLiveWallboardToken } from '@/app/live-bootstrap';
import { registerServiceWorker } from '@/lib/offline-utils';
import { initPwaInstallListener, shouldShowInstallUi, subscribePwaInstall } from '@/lib/pwa-install';
import { startPeriodicVersionCheck } from '@/lib/version-check';
import { appRouter } from '@/app/router';

initPwaInstallListener();
subscribePwaInstall(() => {
  if (appRouter.getRoute() === 'home' && shouldShowInstallUi()) {
    appRouter.navigate('home');
  }
});

async function main(): Promise<void> {
  startPeriodicVersionCheck();

  const root = document.getElementById('app');
  const wallboardToken = parseLiveWallboardToken(window.location.pathname);

  if (wallboardToken && root) {
    await bootstrapLiveWallboard(root, wallboardToken);
    await registerServiceWorker();
    return;
  }

  await bootstrapApp();
  await registerServiceWorker();
}

main().catch((error) => {
  console.error('[Dink] Failed to bootstrap app', error);
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = '<p>Failed to start Dink Syndicate. Try refreshing the page.</p>';
  }
});
