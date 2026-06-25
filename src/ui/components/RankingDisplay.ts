import { el } from '@/lib/dom-utils';
import {
  getPodiumRank,
  mountRankingPodiumIcon,
  PodiumRank,
} from '@/ui/icons/ranking-podium-icons';
import { statsViewLabel } from '@/modules/stats/StatsReportService';
import type { StatsView } from '@/types/player';

export function createStatsScopeBadge(
  statsView: StatsView,
  variant: 'app' | 'export' = 'app'
): HTMLElement {
  const className =
    variant === 'export'
      ? `stats-export-report__scope-badge stats-export-report__scope-badge--${statsView}`
      : `stats-scope-badge stats-scope-badge--${statsView}`;

  return el('span', { className }, [statsViewLabel(statsView)]);
}

/** Single-line player cell: trophy + rank + name + podium badge (top 3 only). */
export function createRankingPlayerCell(
  name: string,
  rankIndex: number,
  variant: 'app' | 'export' = 'app'
): HTMLElement {
  const prefix = variant === 'export' ? 'stats-export-report' : 'stats-table';
  const podium = getPodiumRank(rankIndex);
  const rankNumber = rankIndex + 1;

  const cell = el('td', { className: `${prefix}__player-cell` });
  const inline = el('span', { className: `${prefix}__player-inline` });

  if (podium) {
    const iconWrap = el('span', {
      className: `${prefix}__podium-icon ${prefix}__podium-icon--${podium}`,
    });
    mountRankingPodiumIcon(iconWrap, podium);
    inline.append(iconWrap);
  }

  inline.append(
    el('span', { className: `${prefix}__player-rank` }, [String(rankNumber)]),
    el('span', { className: `${prefix}__player-name` }, [name])
  );

  if (podium) {
    const label = el('span', {
      className: `${prefix}__podium-label ${prefix}__podium-label--${podium}`,
    });
    label.textContent = podiumLabel(podium);
    inline.append(label);
  }

  cell.append(inline);
  return cell;
}

function podiumLabel(rank: PodiumRank): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  return '3rd';
}
