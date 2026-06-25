import { APP_NAME, APP_TAGLINE, LOGO_URL } from '@/config/constants';
import { el } from '@/lib/dom-utils';
import {
  formatAnalyticsDuration,
  formatAnalyticsMatchDuration,
  formatUtilizationPercent,
} from '@/modules/stats/QueueAnalyticsService';
import {
  StatsReportData,
  formatReportGeneratedAt,
  statsViewLabel,
} from '@/modules/stats/StatsReportService';
import { renderSessionSummaryHighlights } from '@/ui/components/SessionSummaryHighlights';
import {
  createRankingPlayerCell,
  createStatsScopeBadge,
} from '@/ui/components/RankingDisplay';
import { MatchHistoryData } from '@/modules/stats/MatchHistoryService';

function reportHeader(data: StatsReportData): HTMLElement {
  const header = el('header', { className: 'stats-export-report__header' });
  const headerMain = el('div', { className: 'stats-export-report__header-main' });

  const titles = el('div', { className: 'stats-export-report__titles' });
  titles.append(
    el('h1', { className: 'stats-export-report__app-name' }, [APP_NAME]),
    el('p', { className: 'stats-export-report__tagline' }, [APP_TAGLINE])
  );

  const logoWrap = el('div', { className: 'stats-export-report__logo-wrap' });
  const logo = el('img', {
    className: 'stats-export-report__logo',
    src: new URL(LOGO_URL, window.location.href).href,
    alt: `${APP_NAME} logo`,
  }) as HTMLImageElement;
  logo.crossOrigin = 'anonymous';
  logoWrap.append(logo);

  headerMain.append(
    titles,
    createStatsScopeBadge(data.statsView, 'export'),
    el('p', { className: 'stats-export-report__generated' }, [
      `Generated ${formatReportGeneratedAt(data.generatedAt)}`,
    ]),
    el('p', { className: 'stats-export-report__meta' }, [
      `Organizer: ${data.sessionName}`,
    ])
  );

  header.append(headerMain, logoWrap);
  return header;
}

function reportStatGrid(items: Array<{ label: string; value: string }>): HTMLElement {
  const grid = el('div', { className: 'stats-export-report__grid' });
  for (const item of items) {
    grid.append(
      el('div', { className: 'stats-export-report__stat' }, [
        el('strong', {}, [item.value]),
        el('span', {}, [item.label]),
      ])
    );
  }
  return grid;
}

export function renderSummaryExportReport(data: StatsReportData): HTMLElement {
  const root = el('article', { className: 'stats-export-report stats-export-report--summary' });
  root.append(reportHeader(data));

  const summary = el('section', { className: 'stats-export-report__block' });
  summary.append(
    el('h2', { className: 'stats-export-report__block-title' }, [
      `Session summary — ${statsViewLabel(data.statsView)}`,
    ])
  );
  summary.append(
    reportStatGrid([
      { label: 'Games played', value: String(data.summary.gamesPlayed) },
      { label: 'Matches completed', value: String(data.summary.matchesCompleted) },
      { label: 'Active now', value: String(data.summary.activeNow) },
      { label: 'Players', value: String(data.summary.players) },
    ])
  );
  root.append(summary);

  root.append(
    renderSessionSummaryHighlights({
      starPlayers: data.starPlayers,
      pairStatistics: data.pairStatistics,
      playersNeedingEncouragement: data.playersNeedingEncouragement,
    })
  );

  const analytics = el('section', { className: 'stats-export-report__block' });
  analytics.append(el('h2', { className: 'stats-export-report__block-title' }, ['Queue analytics']));
  analytics.append(
    reportStatGrid([
      { label: 'Avg queue wait', value: formatAnalyticsDuration(data.analytics.avgQueueWaitMs) },
      {
        label: 'Avg match length',
        value: formatAnalyticsMatchDuration(data.analytics.avgMatchDurationMs),
      },
      {
        label: 'Longest player wait',
        value: formatAnalyticsDuration(data.analytics.longestAvailableWaitMs),
      },
      {
        label: 'Court utilization',
        value: formatUtilizationPercent(data.analytics.courtUtilizationPercent),
      },
      {
        label: 'Matches this hour',
        value: String(data.analytics.matchesCompletedLastHour),
      },
      { label: 'Waiting in queue', value: String(data.analytics.currentQueueDepth) },
    ])
  );
  root.append(analytics);

  return root;
}

export function renderRankingsExportReport(data: StatsReportData): HTMLElement {
  const root = el('article', { className: 'stats-export-report stats-export-report--rankings' });
  root.append(reportHeader(data));

  const section = el('section', { className: 'stats-export-report__block' });
  section.append(
    el('h2', { className: 'stats-export-report__block-title' }, [
      `Player rankings — ${statsViewLabel(data.statsView)}`,
    ])
  );

  if (data.rankings.length === 0) {
    section.append(el('p', { className: 'stats-export-report__empty' }, ['No players yet.']));
    root.append(section);
    return root;
  }

  const table = el('table', { className: 'stats-export-report__table' });
  const thead = el('thead');
  thead.append(
    el('tr', {}, [
      el('th', {}, ['Player']),
      el('th', {}, ['Pts']),
      el('th', {}, ['Games']),
      el('th', {}, ['W-L']),
      el('th', {}, ['Win %']),
      el('th', {}, ['Rating']),
    ])
  );

  const tbody = el('tbody');
  data.rankings.forEach((row, index) => {
    tbody.append(
      el('tr', {}, [
        createRankingPlayerCell(row.name, index, 'export'),
        el('td', {}, [String(row.points)]),
        el('td', {}, [String(row.gamesPlayed)]),
        el('td', {}, [`${row.wins}-${row.losses}`]),
        el('td', {}, [row.winRateLabel]),
        el('td', {}, [row.rating]),
      ])
    );
  });

  table.append(thead, tbody);
  section.append(table);
  root.append(section);
  return root;
}

function queueReportHeader(sessionName: string, generatedAt: Date): HTMLElement {
  const header = el('header', { className: 'stats-export-report__header' });
  const headerMain = el('div', { className: 'stats-export-report__header-main' });

  const titles = el('div', { className: 'stats-export-report__titles' });
  titles.append(
    el('h1', { className: 'stats-export-report__app-name' }, [APP_NAME]),
    el('p', { className: 'stats-export-report__tagline' }, [APP_TAGLINE])
  );

  const logoWrap = el('div', { className: 'stats-export-report__logo-wrap' });
  const logo = el('img', {
    className: 'stats-export-report__logo',
    src: new URL(LOGO_URL, window.location.href).href,
    alt: `${APP_NAME} logo`,
  }) as HTMLImageElement;
  logo.crossOrigin = 'anonymous';
  logoWrap.append(logo);

  headerMain.append(
    titles,
    el('p', { className: 'stats-export-report__generated' }, [
      `Generated ${formatReportGeneratedAt(generatedAt)}`,
    ]),
    el('p', { className: 'stats-export-report__meta' }, [`Organizer: ${sessionName} · Queue analytics`])
  );

  header.append(headerMain, logoWrap);
  return header;
}

export function renderQueueAnalyticsExportReport(
  data: MatchHistoryData,
  sessionName: string,
  generatedAt = new Date()
): HTMLElement {
  const root = el('article', { className: 'stats-export-report stats-export-report--queue' });
  root.append(queueReportHeader(sessionName, generatedAt));

  const metrics = el('section', { className: 'stats-export-report__block' });
  metrics.append(el('h2', { className: 'stats-export-report__block-title' }, ['Queue analytics']));
  metrics.append(
    reportStatGrid([
      { label: 'Total matches', value: String(data.analytics.matchesCompletedThisSession) },
      { label: 'Avg queue wait', value: formatAnalyticsDuration(data.analytics.avgQueueWaitMs) },
      {
        label: 'Avg match length',
        value: formatAnalyticsMatchDuration(data.analytics.avgMatchDurationMs),
      },
      {
        label: 'Longest player wait',
        value: formatAnalyticsDuration(data.analytics.longestAvailableWaitMs),
      },
      {
        label: 'Court utilization',
        value: formatUtilizationPercent(data.analytics.courtUtilizationPercent),
      },
      { label: 'Waiting in queue', value: String(data.analytics.currentQueueDepth) },
    ])
  );
  root.append(metrics);

  const matchesSection = el('section', { className: 'stats-export-report__block' });
  matchesSection.append(
    el('h2', { className: 'stats-export-report__block-title' }, [
      `All Matches (${data.matches.length})`,
    ])
  );

  if (data.matches.length === 0) {
    matchesSection.append(el('p', { className: 'stats-export-report__empty' }, ['No completed matches yet.']));
  } else {
    const list = el('ul', { className: 'stats-export-report__list' });
    for (const row of data.matches) {
      const secondaryParts = [
        `Winner: ${row.winnerLabel}`,
        `Wait: ${row.waitLabel}`,
        `Duration: ${row.durationLabel}`,
      ];
      if (row.note) secondaryParts.push(`Note: ${row.note}`);

      list.append(
        el('li', { className: 'stats-export-report__list-item' }, [
          el('span', { className: 'stats-export-report__list-primary' }, [
            `#${row.matchNumber} · ${row.label}`,
          ]),
          el('span', { className: 'stats-export-report__list-secondary' }, [
            secondaryParts.join(' · '),
          ]),
        ])
      );
    }
    matchesSection.append(list);
  }
  root.append(matchesSection);

  return root;
}
