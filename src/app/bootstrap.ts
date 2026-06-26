import { runFirebaseAuthGate } from '@/app/auth-gate';
import { appRouter, AppRoute } from '@/app/router';
import { isFirebaseEnabled } from '@/config/firebase';
import { isAppOwner } from '@/modules/auth/isAppOwner';
import { appAnalyticsService } from '@/modules/analytics/AppAnalyticsService';
import { livePublishService } from '@/modules/live/LivePublishService';
import { AppShell, mountAppShell, setActiveShellRoute } from '@/ui/shell/app-shell';
import { isOnline, onConnectivityChange } from '@/lib/offline-utils';
import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { renderCourtsScreen } from '@/ui/screens/CourtsScreen';
import { renderHomeScreen } from '@/ui/screens/HomeScreen';
import { renderPlayersScreen } from '@/ui/screens/PlayersScreen';
import { renderQueueScreen } from '@/ui/screens/QueueScreen';
import { renderSettingsScreen } from '@/ui/screens/SettingsScreen';
import { renderStatsScreen } from '@/ui/screens/StatsScreen';
import { renderAdminScreen, teardownAdminScreen } from '@/ui/screens/AdminScreen';
import { clearElement } from '@/lib/dom-utils';

let shell: AppShell | null = null;
let lastRoute: AppRoute | null = null;

function showAdminTab(): boolean {
  const session = useSessionStore.getState().session;
  return isFirebaseEnabled() && isAppOwner(session);
}

function guardAdminRoute(route: AppRoute): AppRoute {
  if (route === 'admin' && !showAdminTab()) {
    return 'home';
  }
  return route;
}

function renderTab(route: AppRoute): void {
  if (!shell) return;

  if (lastRoute === 'admin' && route !== 'admin') {
    teardownAdminScreen();
  }
  lastRoute = route;

  const pane = shell.tabPanes[route];
  clearElement(pane);

  switch (route) {
    case 'home':
      renderHomeScreen(pane);
      break;
    case 'players':
      renderPlayersScreen(pane);
      break;
    case 'queue':
      renderQueueScreen(pane);
      break;
    case 'courts':
      renderCourtsScreen(pane);
      break;
    case 'stats':
      renderStatsScreen(pane);
      break;
    case 'settings':
      renderSettingsScreen(pane);
      break;
    case 'admin':
      renderAdminScreen(pane);
      break;
    default:
      renderHomeScreen(pane);
  }
}

function renderApp(): void {
  const root = document.getElementById('app');
  if (!root) return;

  const ownerVisible = showAdminTab();
  const adminMismatch = shell && Boolean(shell.adminBtn) !== ownerVisible;

  if (!shell || adminMismatch) {
    shell = mountAppShell(
      root,
      (route) => {
        const next = guardAdminRoute(route);
        void appAnalyticsService.onRouteChange(next);
        appRouter.navigate(next);
      },
      { showAdmin: ownerVisible }
    );
  }

  const route = guardAdminRoute(appRouter.getRoute());
  if (route !== appRouter.getRoute()) {
    appRouter.navigate(route);
    return;
  }

  setActiveShellRoute(shell, route);
  renderTab(route);
}

function updateConnectivityBadge(): void {
  const badge = document.getElementById('connectivity-badge');
  if (!badge) return;
  badge.textContent = isOnline() ? 'Online' : 'Offline';
  badge.setAttribute('data-online', String(isOnline()));
}

/** Initialize stores, hydrate from localStorage, mount Smash-style shell. */
export async function bootstrapApp(): Promise<void> {
  appRouter.subscribe(() => renderApp());
  onConnectivityChange(() => updateConnectivityBadge());

  if (isFirebaseEnabled()) {
    await runFirebaseAuthGate(() => renderApp());
    return;
  }

  await useSessionStore.getState().init();
  const snapshot = useSessionStore.getState().loadSnapshot();
  usePlayerStore.getState().hydrate();
  useCourtStore.getState().hydrate();
  useQueueStore.getState().hydrate();
  useQueueUiStore.getState().hydrateFromSettings(snapshot?.settings);
  renderApp();
}

export async function onAppSignOut(): Promise<void> {
  if (livePublishService.isPublishEnabled()) {
    await livePublishService.disablePublish();
  }
  await appAnalyticsService.onSignOut();
}
