import { el } from '@/lib/dom-utils';
import {
  EncouragementPlayerRow,
  StarPlayerRow,
  TopPairRow,
} from '@/modules/stats/StatsReportService';
import {
  StatsHighlightIconId,
  mountStatsHighlightIcon,
} from '@/ui/icons/stats-highlight-icons';

function renderHighlightBlock(
  className: string,
  iconId: StatsHighlightIconId,
  title: string,
  subtitle: string,
  body: HTMLElement
): HTMLElement {
  const block = el('article', { className: `stats-highlight ${className}` });
  const header = el('div', { className: 'stats-highlight__header' });

  const titleEl = el('h4', { className: 'stats-highlight__title' });
  const iconWrap = el('span', { className: 'stats-highlight__title-icon' });
  mountStatsHighlightIcon(iconWrap, iconId);
  titleEl.append(iconWrap, el('span', { className: 'stats-highlight__title-text' }, [title]));

  header.append(
    titleEl,
    el('span', { className: 'stats-highlight__subtitle' }, [subtitle])
  );
  block.append(header, body);
  return block;
}

function renderEmptyHighlight(message: string): HTMLElement {
  return el('p', { className: 'stats-highlight__empty' }, [message]);
}

function renderPairRow(row: TopPairRow, rank: number): HTMLElement {
  return el('div', { className: 'stats-highlight__row stats-highlight__row--pair' }, [
    el('span', { className: 'stats-highlight__rank' }, [`#${rank}`]),
    el('div', { className: 'stats-highlight__row-main' }, [
      el('strong', { className: 'stats-highlight__row-name' }, [row.label]),
      el('span', { className: 'stats-highlight__row-meta' }, [
        `${row.gamesPlayed} games played`,
      ]),
    ]),
    el('div', { className: 'stats-highlight__row-stats' }, [
      el('span', { className: 'stats-highlight__stat stats-highlight__stat--win' }, [
        `${row.wins}W`,
      ]),
      el('span', { className: 'stats-highlight__stat stats-highlight__stat--loss' }, [
        `${row.losses}L`,
      ]),
      el('span', { className: 'stats-highlight__stat stats-highlight__stat--rate' }, [
        row.winRateLabel,
      ]),
    ]),
  ]);
}

function renderPlayerRow(
  name: string,
  meta: string,
  rightPrimary: string,
  rightSecondary: string,
  modifier: 'star' | 'encourage'
): HTMLElement {
  return el('div', {
    className: `stats-highlight__row stats-highlight__row--${modifier}`,
  }, [
    el('div', { className: 'stats-highlight__row-main' }, [
      el('strong', { className: 'stats-highlight__row-name' }, [name]),
      el('span', { className: 'stats-highlight__row-meta' }, [meta]),
    ]),
    el('div', { className: 'stats-highlight__row-stats stats-highlight__row-stats--stacked' }, [
      el('span', { className: 'stats-highlight__stat stats-highlight__stat--primary' }, [
        rightPrimary,
      ]),
      el('span', { className: 'stats-highlight__row-meta' }, [rightSecondary]),
    ]),
  ]);
}

export interface SessionSummaryHighlightsData {
  starPlayers: StarPlayerRow[];
  pairStatistics: TopPairRow[];
  playersNeedingEncouragement: EncouragementPlayerRow[];
}

export function renderSessionSummaryHighlights(data: SessionSummaryHighlightsData): HTMLElement {
  const wrap = el('div', { className: 'stats-highlights' });

  const starsBody = el('div', { className: 'stats-highlight__list' });
  if (data.starPlayers.length === 0) {
    starsBody.append(
      renderEmptyHighlight(
        'No star players yet — players need at least 2 games with a recorded win rate.'
      )
    );
  } else {
    for (const row of data.starPlayers) {
      starsBody.append(
        renderPlayerRow(
          row.name,
          `${row.gamesPlayed} games played`,
          `${row.points} pts`,
          `${row.wins}W-${row.losses}L · ${row.winRateLabel}`,
          'star'
        )
      );
    }
  }
  wrap.append(
    renderHighlightBlock(
      'stats-highlight--star',
      'star',
      'Star players',
      'Top performers',
      starsBody
    )
  );

  const pairsBody = el('div', { className: 'stats-highlight__list' });
  if (data.pairStatistics.length === 0) {
    pairsBody.append(
      renderEmptyHighlight(
        'No pair results yet — complete doubles-style matches to rank partnerships.'
      )
    );
  } else {
    data.pairStatistics.forEach((row, index) => {
      pairsBody.append(renderPairRow(row, index + 1));
    });
  }
  wrap.append(
    renderHighlightBlock(
      'stats-highlight--pairs',
      'pairs',
      'Pair statistics',
      'Best performing pairs',
      pairsBody
    )
  );

  const encourageBody = el('div', { className: 'stats-highlight__list' });
  if (data.playersNeedingEncouragement.length === 0) {
    encourageBody.append(
      renderEmptyHighlight(
        'Everyone’s in a good spot — or add more games to populate this block.'
      )
    );
  } else {
    for (const row of data.playersNeedingEncouragement) {
      encourageBody.append(
        renderPlayerRow(
          row.name,
          `${row.gamesPlayed} games played`,
          `${row.losses} losses`,
          `${row.wins}W-${row.losses}L · ${row.winRateLabel}`,
          'encourage'
        )
      );
    }
  }
  wrap.append(
    renderHighlightBlock(
      'stats-highlight--encourage',
      'encourage',
      'Players needing encouragement',
      'Keep going!',
      encourageBody
    )
  );

  return wrap;
}
