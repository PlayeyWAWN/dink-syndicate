/** Stats session-summary icons (Material Design Icons via Iconify). */

const SVG_ROOT =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"';

export type StatsHighlightIconId = 'pairs' | 'star' | 'encourage';

/** @see https://icon-sets.iconify.design/mdi/trophy/ */
const PAIRS_ICON = `<svg ${SVG_ROOT}><path d="M18 2c-.9 0-2 1-2 2H8c0-1-1.1-2-2-2H2v9c0 1 1 2 2 2h2.2c.4 2 1.7 3.7 4.8 4v2.08C8 19.54 8 22 8 22h8s0-2.46-3-2.92V17c3.1-.3 4.4-2 4.8-4H20c1 0 2-1 2-2V2zM6 11H4V4h2zm14 0h-2V4h2z"/></svg>`;

/** @see https://icon-sets.iconify.design/mdi/star/ */
const STAR_ICON = `<svg ${SVG_ROOT}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2L9.19 8.62L2 9.24l5.45 4.73L5.82 21z"/></svg>`;

/** @see https://icon-sets.iconify.design/mdi/hand-heart/ */
const ENCOURAGE_ICON = `<svg ${SVG_ROOT}><path d="M20 17q.86 0 1.45.6t.58 1.4L14 22l-7-2v-9h1.95l7.27 2.69q.78.31.78 1.12q0 .47-.34.82t-.86.37H13l-1.75-.67l-.33.94L13 17zM16 3.23Q17.06 2 18.7 2q1.36 0 2.3 1t1 2.3q0 1.03-1 2.46t-1.97 2.39T16 13q-2.08-1.89-3.06-2.85t-1.97-2.39T10 5.3q0-1.36.97-2.3t2.34-1q1.6 0 2.69 1.23M.984 11H5v11H.984z"/></svg>`;

const ICONS: Record<StatsHighlightIconId, string> = {
  pairs: PAIRS_ICON,
  star: STAR_ICON,
  encourage: ENCOURAGE_ICON,
};

export function statsHighlightIconHtml(id: StatsHighlightIconId): string {
  return ICONS[id];
}

export function mountStatsHighlightIcon(container: HTMLElement, id: StatsHighlightIconId): void {
  container.innerHTML = statsHighlightIconHtml(id);
}
