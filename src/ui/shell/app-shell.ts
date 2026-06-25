import { el } from '@/lib/dom-utils';
import { mountNavIcon, NavIconId } from '@/ui/icons/nav-icons';

export type TabRoute = 'home' | 'players' | 'courts' | 'queue' | 'stats' | 'settings';

export const TOP_NAV_TABS: { id: TabRoute; label: string; icon: NavIconId }[] = [
  { id: 'players', label: 'Players', icon: 'players' },
  { id: 'courts', label: 'Courts', icon: 'courts' },
  { id: 'queue', label: 'Queue', icon: 'queue' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
];

export type AppRoute = TabRoute;

type RouteListener = (route: AppRoute) => void;

/** Tab router — Smash-style: top nav + bottom Settings/Home. */
export class AppRouter {
  private route: AppRoute = 'home';
  private listeners = new Set<RouteListener>();

  getRoute(): AppRoute {
    return this.route;
  }

  navigate(route: AppRoute): void {
    this.route = route;
    for (const listener of this.listeners) {
      listener(route);
    }
  }

  subscribe(listener: RouteListener): () => void {
    this.listeners.add(listener);
    listener(this.route);
    return () => this.listeners.delete(listener);
  }
}

export const appRouter = new AppRouter();

export interface AppShell {
  tabPanes: Record<TabRoute, HTMLElement>;
  topNav: HTMLElement;
  bottomActions: HTMLElement;
}

/** Build Smash-style app shell once (top nav, tab panes, bottom bar). */
export function mountAppShell(
  root: HTMLElement,
  onNavigate: (route: AppRoute) => void
): AppShell {
  root.replaceChildren();

  const container = el('div', { className: 'app-container', id: 'app-container' });
  const topNav = el('div', { className: 'top-nav', id: 'top-nav' });

  for (const tab of TOP_NAV_TABS) {
    const item = el('div', {
      className: 'nav-item',
      'data-tab': tab.id,
      role: 'button',
      tabindex: '0',
    });
    const iconWrap = el('div', { className: 'nav-icon nav-icon--svg', 'aria-hidden': 'true' });
    mountNavIcon(iconWrap, tab.icon);
    item.append(iconWrap, el('div', {}, [tab.label]));
    item.addEventListener('click', () => onNavigate(tab.id));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigate(tab.id);
      }
    });
    topNav.append(item);
  }

  const content = el('div', { className: 'content' });
  const tabContainer = el('div', { className: 'tab-container' });
  const tabPanes = {} as Record<TabRoute, HTMLElement>;
  const allTabs: TabRoute[] = ['home', 'players', 'courts', 'queue', 'stats', 'settings'];

  for (const id of allTabs) {
    const pane = el('div', {
      className: 'tab-content',
      id: `${id}-tab`,
      'data-tab': id,
    });
    tabPanes[id] = pane;
    tabContainer.append(pane);
  }

  content.append(tabContainer);

  const bottomActions = el('div', { className: 'bottom-actions', id: 'bottom-actions' });

  const settingsBtn = el('button', {
    className: 'btn btn-small',
    id: 'settings-btn',
    type: 'button',
    'data-tab': 'settings',
  });
  const settingsInner = el('span', { className: 'bottom-nav-btn-inner' });
  const settingsIcon = el('span', { 'aria-hidden': 'true' });
  mountNavIcon(settingsIcon, 'settings');
  settingsInner.append(settingsIcon, el('span', {}, ['Settings']));
  settingsBtn.append(settingsInner);
  settingsBtn.addEventListener('click', () => onNavigate('settings'));

  const homeBtn = el('button', {
    className: 'btn-small',
    id: 'home-btn',
    type: 'button',
    'data-tab': 'home',
  });
  const homeInner = el('span', { className: 'bottom-nav-btn-inner' });
  const homeIcon = el('span', { 'aria-hidden': 'true' });
  mountNavIcon(homeIcon, 'home');
  homeInner.append(homeIcon, el('span', {}, ['Home']));
  homeBtn.append(homeInner);
  homeBtn.addEventListener('click', () => onNavigate('home'));

  bottomActions.append(settingsBtn, homeBtn);
  container.append(topNav, content, bottomActions);
  root.append(container);

  return { tabPanes, topNav, bottomActions };
}

export function setActiveShellRoute(shell: AppShell, route: AppRoute): void {
  for (const tab of TOP_NAV_TABS) {
    const item = shell.topNav.querySelector(`[data-tab="${tab.id}"]`);
    item?.classList.toggle('active', route === tab.id);
  }

  for (const id of Object.keys(shell.tabPanes) as TabRoute[]) {
    shell.tabPanes[id].classList.toggle('active', id === route);
  }
}
