/** Top + bottom nav SVG icons (from Smash Syndicate nav set). */

const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"';

export type NavIconId = 'players' | 'courts' | 'queue' | 'stats' | 'settings' | 'home';

const ICONS: Record<NavIconId, string> = {
  players: `<svg ${SVG_ATTRS}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  courts: `<svg ${SVG_ATTRS}><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2"/></svg>`,
  queue: `<svg ${SVG_ATTRS}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9 12h6"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9 16h6"/></svg>`,
  stats: `<svg ${SVG_ATTRS}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 20V10"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 20V4"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 20v-6"/></svg>`,
  settings: `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
  home: `<svg ${SVG_ATTRS}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m3 10 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10z"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 21V12h6v9"/></svg>`,
};

export function navIconHtml(id: NavIconId): string {
  return ICONS[id];
}

export function mountNavIcon(container: HTMLElement, id: NavIconId): void {
  container.innerHTML = navIconHtml(id);
}
