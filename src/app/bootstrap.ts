import { runFirebaseAuthGate } from '@/app/auth-gate';
import { appRouter, AppRoute } from '@/app/router';
import { isFirebaseEnabled } from '@/config/firebase';
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
import { clearElement } from '@/lib/dom-utils';

let shell: AppShell | null = null;

function renderTab(route: AppRoute): void {
  if (!shell) return;
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
    default:
      renderHomeScreen(pane);
  }
}

function renderApp(): void {
  const root = document.getElementById('app');
  if (!root) return;

  if (!shell) {
    shell = mountAppShell(root, (route) => appRouter.navigate(route));
  }

  const route = appRouter.getRoute();
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
