import { RANKINGS_PAGE_SIZE } from '@/config/ranking';
import { el } from '@/lib/dom-utils';
import { buildStatsExportFilename, exportReportAsPng } from '@/lib/export-image';
import { paginateItems } from '@/modules/stats/MatchHistoryService';
import {
  buildIndexedRankingsRows,
  StatsReportData,
} from '@/modules/stats/StatsReportService';
import { useStatsUiStore } from '@/stores/statsUiStore';
import { Player, StatsView } from '@/types/player';
import {
  createRankingPlayerCell,
  createStatsScopeBadge,
} from '@/ui/components/RankingDisplay';
import { renderRankingsExportReport } from '@/ui/components/StatsExportReport';

export interface RankingsTablePanelOptions {
  players: Player[];
  statsView: StatsView;
  sessionName: string;
  buildReportData: () => StatsReportData;
}

function attachReportExportButton(
  label: string,
  sessionName: string,
  statsView: StatsView,
  buildReport: () => HTMLElement
): HTMLElement {
  const button = el('button', { type: 'button', className: 'btn btn-secondary stats-export-btn' }, [
    label,
  ]);

  button.addEventListener('click', async () => {
    button.setAttribute('disabled', 'true');
    const originalLabel = button.textContent;
    button.textContent = 'Exporting…';

    try {
      await exportReportAsPng(
        buildReport(),
        buildStatsExportFilename(sessionName, 'rankings', statsView)
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      button.removeAttribute('disabled');
      button.textContent = originalLabel ?? label;
    }
  });

  return button;
}

/** Player rankings table with name search and paginated rows (max 20 per page). */
export function renderRankingsTablePanel(options: RankingsTablePanelOptions): HTMLElement {
  const { players, statsView, sessionName, buildReportData } = options;
  const ui = useStatsUiStore.getState();

  const section = el('section', { className: 'card stats-section' });
  section.append(
    el('div', { className: 'stats-section__title-row' }, [
      el('h3', { className: 'stats-section__title' }, ['Player rankings']),
      createStatsScopeBadge(statsView, 'app'),
    ]),
    el('p', { className: 'stats-section__lead' }, [
      statsView === 'session'
        ? 'Ranked by points (3 per win, 1 per loss) this session.'
        : 'Ranked by lifetime points (3 per win, 1 per loss).',
    ])
  );

  if (players.length === 0) {
    section.append(el('p', { className: 'empty-state' }, ['No players yet.']));
    return section;
  }

  const searchField = el('div', { className: 'stats-rankings-search' });
  const searchInput = el('input', {
    id: 'stats-rankings-search',
    type: 'search',
    className: 'stats-rankings-search__input',
    placeholder: 'Search players by name…',
    value: ui.rankingsSearchQuery,
    'aria-label': 'Search player rankings by name',
  }) as HTMLInputElement;
  searchField.append(
    el('label', { className: 'stats-rankings-search__label', for: 'stats-rankings-search' }, [
      'Search players',
    ]),
    searchInput
  );
  section.append(searchField);

  const table = el('table', { className: 'stats-table' });
  const thead = el('thead');
  thead.append(
    el('tr', {}, [
      el('th', { className: 'stats-table__col-player' }, ['Player']),
      el('th', { className: 'stats-table__col-stat', title: 'Points' }, ['Pts']),
      el('th', { className: 'stats-table__col-stat', title: 'Games played' }, ['G']),
      el('th', { className: 'stats-table__col-stat', title: 'Wins and losses' }, ['W-L']),
      el('th', { className: 'stats-table__col-stat', title: 'Win percentage' }, ['%']),
      el('th', { className: 'stats-table__col-stat', title: 'DUPR rating' }, ['DUPR']),
    ])
  );
  const tbody = el('tbody');
  table.append(thead, tbody);

  const emptyMessage = el('p', {
    className: 'empty-state stats-rankings__empty',
    hidden: 'true',
  }, ['No players match your search.']);

  const pagination = el('nav', {
    className: 'stats-rankings__pagination',
    'aria-label': 'Player rankings pages',
  });

  const renderPage = (): void => {
    const searchQuery = useStatsUiStore.getState().rankingsSearchQuery;
    const currentPage = useStatsUiStore.getState().rankingsPage;
    const indexedRows = buildIndexedRankingsRows(players, statsView, searchQuery);

    if (indexedRows.length === 0) {
      tbody.replaceChildren();
      emptyMessage.hidden = false;
      pagination.replaceChildren(
        el('p', { className: 'stats-rankings__pagination-meta' }, ['No matching players'])
      );
      return;
    }

    emptyMessage.hidden = true;
    const pageData = paginateItems(indexedRows, currentPage, RANKINGS_PAGE_SIZE);

    if (pageData.page !== currentPage) {
      useStatsUiStore.getState().setRankingsPage(pageData.page);
    }

    tbody.replaceChildren(
      ...pageData.items.map(({ row, rankIndex }) =>
        el('tr', {}, [
          createRankingPlayerCell(row.name, rankIndex, 'app'),
          el('td', {}, [String(row.points)]),
          el('td', {}, [String(row.gamesPlayed)]),
          el('td', {}, [`${row.wins}-${row.losses}`]),
          el('td', {}, [row.winRateLabel]),
          el('td', {}, [row.rating]),
        ])
      )
    );

    pagination.replaceChildren();
    if (pageData.totalPages <= 1) {
      const label =
        searchQuery.trim().length > 0
          ? `Showing ${pageData.totalItems} matching player${pageData.totalItems === 1 ? '' : 's'}`
          : `Showing all ${pageData.totalItems} player${pageData.totalItems === 1 ? '' : 's'}`;
      pagination.append(el('p', { className: 'stats-rankings__pagination-meta' }, [label]));
      return;
    }

    const prevButton = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary stats-rankings__pagination-btn',
        disabled: pageData.page === 0 ? 'true' : undefined,
      },
      ['Previous']
    ) as HTMLButtonElement;

    const nextButton = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary stats-rankings__pagination-btn',
        disabled: pageData.page >= pageData.totalPages - 1 ? 'true' : undefined,
      },
      ['Next']
    ) as HTMLButtonElement;

    prevButton.addEventListener('click', () => {
      const page = useStatsUiStore.getState().rankingsPage;
      if (page > 0) {
        useStatsUiStore.getState().setRankingsPage(page - 1);
        renderPage();
      }
    });

    nextButton.addEventListener('click', () => {
      const page = useStatsUiStore.getState().rankingsPage;
      if (page < pageData.totalPages - 1) {
        useStatsUiStore.getState().setRankingsPage(page + 1);
        renderPage();
      }
    });

    pagination.append(
      prevButton,
      el('span', { className: 'stats-rankings__pagination-meta' }, [
        `Showing ${pageData.rangeStart}–${pageData.rangeEnd} of ${pageData.totalItems} · Page ${pageData.page + 1} of ${pageData.totalPages}`,
      ]),
      nextButton
    );
  };

  searchInput.addEventListener('input', () => {
    useStatsUiStore.getState().setRankingsSearchQuery(searchInput.value);
    renderPage();
  });

  section.append(table, emptyMessage, pagination);
  renderPage();

  section.append(
    attachReportExportButton('Export rankings PNG', sessionName, statsView, () =>
      renderRankingsExportReport(buildReportData())
    )
  );

  return section;
}
