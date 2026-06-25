/** Podium icons for top-3 player rankings (Material Design Icons via Iconify). */

const SVG_ROOT =
  'xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"';

export type PodiumRank = 1 | 2 | 3;

/** @see https://icon-sets.iconify.design/mdi/trophy/ */
const TROPHY_ICON = `<svg ${SVG_ROOT}><path d="M18 2c-.9 0-2 1-2 2H8c0-1-1.1-2-2-2H2v9c0 1 1 2 2 2h2.2c.4 2 1.7 3.7 4.8 4v2.08C8 19.54 8 22 8 22h8s0-2.46-3-2.92V17c3.1-.3 4.4-2 4.8-4H20c1 0 2-1 2-2V2zM6 11H4V4h2zm14 0h-2V4h2z"/></svg>`;

/** @see https://icon-sets.iconify.design/mdi/medal/ */
const MEDAL_ICON = `<svg ${SVG_ROOT}><path d="M20 2H4v3.16l4.211 2.066L8 13.708V22h8v-8.292l-.211-6.482L20 5.16zm-8 9.847l-4-2V6.066l4 2.001zm6-2.001V9.846l-4 2zM4 20h16v2H4z"/></svg>`;

const ICONS: Record<PodiumRank, string> = {
  1: TROPHY_ICON,
  2: MEDAL_ICON,
  3: MEDAL_ICON,
};

export function getPodiumRank(rankIndex: number): PodiumRank | null {
  if (rankIndex === 0) return 1;
  if (rankIndex === 1) return 2;
  if (rankIndex === 2) return 3;
  return null;
}

export function rankingPodiumIconHtml(rank: PodiumRank): string {
  return ICONS[rank];
}

export function mountRankingPodiumIcon(container: HTMLElement, rank: PodiumRank): void {
  container.innerHTML = rankingPodiumIconHtml(rank);
  container.classList.add('ranking-podium-icon', `ranking-podium-icon--${rank}`);
}
