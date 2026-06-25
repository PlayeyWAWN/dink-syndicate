import { exportReportAsPng } from '@/lib/export-image';
import {
  buildMatchHistoryCsv,
  buildMatchHistoryExportFilename,
  buildMatchHistoryTxt,
  downloadTextFile,
} from '@/lib/match-history-export';
import { el } from '@/lib/dom-utils';
import { mountLiveTimers } from '@/lib/match-timer';
import {
  buildMatchHistoryData,
  longestMatchDurationMs,
  longestMatchQueueWaitMs,
  MatchHistoryData,
  MATCH_HISTORY_PAGE_SIZE,
  MatchHistoryRow,
  paginateItems,
} from '@/modules/stats/MatchHistoryService';
import {
  formatAnalyticsDuration,
  formatAnalyticsMatchDuration,
  formatUtilizationPercent,
  QueueAnalytics,
} from '@/modules/stats/QueueAnalyticsService';
import { renderQueueAnalyticsExportReport } from '@/ui/components/StatsExportReport';
import { Match } from '@/types/queue';
import { Player } from '@/types/player';

const WAITING_PLAYERS_TOP_N = 3;

function statCard(label: string, value: string, modifier?: string): HTMLElement {
  const className = modifier
    ? `queue-analytics__metric queue-analytics__metric--${modifier}`
    : 'queue-analytics__metric';
  return el('div', { className }, [
    el('strong', { className: 'queue-analytics__metric-value' }, [value]),
    el('span', { className: 'queue-analytics__metric-label' }, [label]),
  ]);
}

function attachExportButton(
  label: string,
  className: string,
  onClick: () => void | Promise<void>
): HTMLButtonElement {
  const button = el('button', { type: 'button', className }, [label]) as HTMLButtonElement;
  button.addEventListener('click', async () => {
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Exporting…';
    try {
      await onClick();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      button.disabled = false;
      button.textContent = original ?? label;
    }
  });
  return button;
}

function renderWaitingPlayers(data: MatchHistoryData): HTMLElement {
  const block = el('section', { className: 'queue-analytics__subsection' });
  block.append(
    el('h4', { className: 'queue-analytics__subsection-title' }, [
      'Longest waiting players (ready to be queued)',
    ])
  );

  if (data.waitingPlayers.length === 0) {
    block.append(
      el('p', { className: 'queue-analytics__empty' }, ['No checked-in players waiting for a match.'])
    );
    return block;
  }

  const list = el('ol', { className: 'queue-analytics__waiting-list' });
  const visible = data.waitingPlayers.slice(0, WAITING_PLAYERS_TOP_N);

  for (const [index, player] of visible.entries()) {
    const waitNode = el('span', {
      className: 'queue-analytics__waiting-time',
      'data-available-since': String(player.availableSince),
    });
    waitNode.textContent = player.waitLabel;

    list.append(
      el('li', { className: 'queue-analytics__waiting-item' }, [
        el('div', { className: 'queue-analytics__waiting-main' }, [
          el('span', { className: 'queue-analytics__waiting-rank' }, [`#${index + 1}`]),
          el('span', { className: 'queue-analytics__waiting-name' }, [player.name]),
          el('span', { className: 'queue-analytics__waiting-meta' }, [
            `Rating ${player.skillLabel} · ${player.gamesPlayed} games played`,
          ]),
        ]),
        waitNode,
      ])
    );
  }

  block.append(list);

  const remaining = data.waitingPlayers.length - visible.length;
  if (remaining > 0) {
    block.append(
      el('p', { className: 'queue-analytics__waiting-more' }, [`+${remaining} more on standby`])
    );
  }

  return block;
}

function renderMatchCard(row: MatchHistoryRow): HTMLElement {
  const main = el('div', { className: 'queue-analytics__match-main' });
  main.append(
    el('strong', { className: 'queue-analytics__match-label' }, [row.label]),
    el('span', { className: 'queue-analytics__match-winner' }, [`Winner: ${row.winnerLabel}`]),
    el('div', { className: 'queue-analytics__match-meta' }, [
      el('span', {}, [`Wait: ${row.waitLabel}`]),
      el('span', {}, [`Duration: ${row.durationLabel}`]),
    ])
  );

  if (row.note) {
    main.append(
      el('p', { className: 'queue-analytics__match-note' }, [
        el('span', { className: 'queue-analytics__match-note-label' }, ['Note: ']),
        row.note,
      ])
    );
  }

  return el('article', { className: 'queue-analytics__match-card' }, [
    el('span', { className: 'queue-analytics__match-rank' }, [`#${row.matchNumber}`]),
    main,
  ]);
}

function renderMatchHistoryList(
  data: MatchHistoryData,
  sessionName: string
): HTMLElement {
  const block = el('section', { className: 'queue-analytics__subsection' });
  const titleRow = el('div', { className: 'queue-analytics__matches-head' });
  titleRow.append(
    el('h4', { className: 'queue-analytics__subsection-title' }, [
      `All Matches (${data.matches.length})`,
    ]),
    renderExportToolbar(data, sessionName)
  );
  block.append(titleRow);

  if (data.matches.length === 0) {
    block.append(
      el('p', { className: 'queue-analytics__empty' }, [
        'No completed matches yet — finish a match to build session history.',
      ])
    );
    return block;
  }

  let currentPage = 0;
  const list = el('div', { className: 'queue-analytics__match-list' });
  const pagination = el('nav', {
    className: 'queue-analytics__pagination',
    'aria-label': 'Match history pages',
  });

  const renderPage = (): void => {
    const pageData = paginateItems(data.matches, currentPage);
    list.replaceChildren(...pageData.items.map((row) => renderMatchCard(row)));

    pagination.replaceChildren();
    if (pageData.totalPages <= 1) {
      pagination.append(
        el('p', { className: 'queue-analytics__pagination-meta' }, [
          `Showing all ${pageData.totalItems} matches`,
        ])
      );
      return;
    }

    const prevButton = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary queue-analytics__pagination-btn',
        disabled: pageData.page === 0 ? 'true' : undefined,
      },
      ['Previous']
    ) as HTMLButtonElement;

    const nextButton = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary queue-analytics__pagination-btn',
        disabled: pageData.page >= pageData.totalPages - 1 ? 'true' : undefined,
      },
      ['Next']
    ) as HTMLButtonElement;

    prevButton.addEventListener('click', () => {
      if (currentPage > 0) {
        currentPage -= 1;
        renderPage();
      }
    });

    nextButton.addEventListener('click', () => {
      if (currentPage < pageData.totalPages - 1) {
        currentPage += 1;
        renderPage();
      }
    });

    pagination.append(
      prevButton,
      el('span', { className: 'queue-analytics__pagination-meta' }, [
        `Showing ${pageData.rangeStart}–${pageData.rangeEnd} of ${pageData.totalItems} · Page ${pageData.page + 1} of ${pageData.totalPages}`,
      ]),
      nextButton
    );
  };

  renderPage();
  const fragments: HTMLElement[] = [];
  if (data.matches.length > MATCH_HISTORY_PAGE_SIZE) {
    fragments.push(
      el('p', { className: 'queue-analytics__matches-lead' }, [
        `Showing ${MATCH_HISTORY_PAGE_SIZE} matches per page. Export .txt, .csv, or Image for the full list.`,
      ])
    );
  }
  fragments.push(list, pagination);
  block.append(...fragments);
  return block;
}

function renderExportToolbar(
  data: MatchHistoryData,
  sessionName: string
): HTMLElement {
  const toolbar = el('div', { className: 'queue-analytics__export-toolbar' });

  toolbar.append(
    attachExportButton('.txt', 'btn btn-secondary queue-analytics__export-btn', () => {
      downloadTextFile(
        buildMatchHistoryExportFilename(sessionName, 'txt'),
        buildMatchHistoryTxt(data, sessionName),
        'text/plain;charset=utf-8'
      );
    }),
    attachExportButton('.csv', 'btn btn-secondary queue-analytics__export-btn', () => {
      downloadTextFile(
        buildMatchHistoryExportFilename(sessionName, 'csv'),
        buildMatchHistoryCsv(data),
        'text/csv;charset=utf-8'
      );
    }),
    attachExportButton('Image', 'btn btn-secondary queue-analytics__export-btn', async () => {
      await exportReportAsPng(
        renderQueueAnalyticsExportReport(data, sessionName),
        buildMatchHistoryExportFilename(sessionName, 'png')
      );
    })
  );

  return toolbar;
}

export function renderQueueAnalyticsPanel(input: {
  completedMatches: Match[];
  players: Player[];
  analytics: QueueAnalytics;
  sessionName: string;
}): HTMLElement {
  const historyData = buildMatchHistoryData({
    completedMatches: input.completedMatches,
    players: input.players,
    analytics: input.analytics,
  });

  const panel = el('section', { className: 'card stats-section queue-analytics' });
  const header = el('div', { className: 'queue-analytics__header' });
  header.append(
    el('div', {}, [
      el('h3', { className: 'stats-section__title queue-analytics__title' }, ['Queue analytics']),
      el('p', { className: 'stats-section__lead queue-analytics__lead' }, [
        'Match performance metrics and full session match history.',
      ]),
    ]),
    el('span', { className: 'queue-analytics__subtitle' }, ['Match Performance Metrics'])
  );
  panel.append(header);

  const metrics = el('div', { className: 'queue-analytics__metrics' });
  metrics.append(
    statCard('Total matches', String(input.analytics.matchesCompletedThisSession), 'purple'),
    statCard('Avg wait time', formatAnalyticsDuration(input.analytics.avgQueueWaitMs), 'blue'),
    statCard(
      'Longest match queue time',
      formatAnalyticsDuration(longestMatchQueueWaitMs(input.completedMatches)),
      'orange'
    ),
    statCard(
      'Longest match',
      formatAnalyticsMatchDuration(longestMatchDurationMs(input.completedMatches)),
      'green'
    )
  );
  panel.append(metrics);

  const secondaryMetrics = el('div', { className: 'stat-grid stats-section__grid' });
  secondaryMetrics.append(
    statCard('Avg match length', formatAnalyticsMatchDuration(input.analytics.avgMatchDurationMs)),
    statCard('Longest player wait', formatAnalyticsDuration(input.analytics.longestAvailableWaitMs)),
    statCard('Court utilization', formatUtilizationPercent(input.analytics.courtUtilizationPercent)),
    statCard('Waiting in queue', String(input.analytics.currentQueueDepth))
  );
  panel.append(secondaryMetrics);

  panel.append(renderWaitingPlayers(historyData));
  panel.append(renderMatchHistoryList(historyData, input.sessionName));

  mountLiveTimers(panel);
  return panel;
}
