/**
 * Player row action icons — Lucide set via Iconify (icon-sets.iconify.design/lucide).
 * Inline SVG for offline PWA (no CDN at runtime).
 */
const SVG = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"';

export type PlayerActionIconId =
  | 'edit'
  | 'checkout'
  | 'checkin'
  | 'exclude'
  | 'include'
  | 'delete'
  | 'pause';

/** @see https://icon-sets.iconify.design/lucide/ */
const ICONS: Record<PlayerActionIconId, string> = {
  edit: `<svg ${SVG}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg>`,
  checkout: `<svg ${SVG}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="16 17 21 12 16 7"/><line stroke="currentColor" stroke-width="2" stroke-linecap="round" x1="21" y1="12" x2="9" y2="12"/></svg>`,
  checkin: `<svg ${SVG}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="10 17 5 12 10 7"/><line stroke="currentColor" stroke-width="2" stroke-linecap="round" x1="5" y1="12" x2="21" y2="12"/></svg>`,
  exclude: `<svg ${SVG}><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m4.9 4.9 14.2 14.2"/></svg>`,
  include: `<svg ${SVG}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`,
  delete: `<svg ${SVG}><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M10 11v6M14 11v6"/></svg>`,
  pause: `<svg ${SVG}><rect x="6" y="4" width="4" height="16" rx="1" stroke="currentColor" stroke-width="2"/><rect x="14" y="4" width="4" height="16" rx="1" stroke="currentColor" stroke-width="2"/></svg>`,
};

export function playerActionIconHtml(id: PlayerActionIconId): string {
  return ICONS[id];
}
