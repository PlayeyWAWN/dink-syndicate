import { formatTeamLabel, matchLabel, winningTeamForMatch } from '@/lib/format-utils';
import { formatMatchDuration } from '@/lib/match-timer';
import {
  CompletedMatchUpdate,
  RECENT_COMPLETED_MATCHES_PAGE_SIZE,
  sortCompletedMatchesNewestFirst,
} from '@/modules/queue/CompletedMatchService';
import { paginateItems } from '@/modules/stats/MatchHistoryService';
import { el } from '@/lib/dom-utils';
import { openCompletedMatchEditDialog } from '@/ui/components/CompletedMatchEditDialog';
import { Match } from '@/types/queue';
import { Player } from '@/types/player';

export interface RecentCompletedMatchesPanelOptions {
  completedMatches: Match[];
  players: Player[];
  onUpdateMatch: (
    matchId: string,
    update: CompletedMatchUpdate
  ) => { ok: true } | { ok: false; message: string };
}

function formatCompletedWhen(completedAt: number | undefined): string {
  if (completedAt == null) return 'Just now';
  const elapsed = Date.now() - completedAt;
  if (elapsed < 60_000) return 'Just now';
  return `${formatMatchDuration(elapsed)} ago`;
}

function renderRecentMatchCard(
  match: Match,
  players: Player[],
  onUpdateMatch: RecentCompletedMatchesPanelOptions['onUpdateMatch']
): HTMLElement {
  const winningTeam = winningTeamForMatch(match);
  const winnerLabel =
    winningTeam != null
      ? formatTeamLabel(match.playerIds, players, winningTeam)
      : 'Unknown';

  const card = el('article', { className: 'recent-match-card' });
  const main = el('div', { className: 'recent-match-card__main' });
  main.append(
    el('strong', { className: 'recent-match-card__label' }, [matchLabel(match, players)]),
    el('span', { className: 'recent-match-card__winner' }, [`Winner: ${winnerLabel}`]),
    el('span', { className: 'recent-match-card__when' }, [formatCompletedWhen(match.completedAt)])
  );

  if (match.correctionNote?.trim()) {
    main.append(
      el('p', { className: 'recent-match-card__note' }, [
        el('span', { className: 'recent-match-card__note-label' }, ['Note: ']),
        match.correctionNote.trim(),
      ])
    );
  }

  const editBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm recent-match-card__edit-btn',
  }, ['Edit']);

  editBtn.addEventListener('click', () => {
    openCompletedMatchEditDialog({
      match,
      players,
      onSave: (update) => {
        const result = onUpdateMatch(match.id, update);
        if (!result.ok) {
          alert(result.message);
          return false;
        }
      },
    });
  });

  card.append(main, editBtn);
  return card;
}

export function renderRecentCompletedMatchesPanel(
  options: RecentCompletedMatchesPanelOptions
): HTMLElement {
  const { completedMatches, players, onUpdateMatch } = options;
  const sorted = sortCompletedMatchesNewestFirst(completedMatches);

  const section = el('section', { className: 'queue-section queue-section--recent' });
  section.append(
    el('div', { className: 'queue-section__header' }, [
      el('h2', { className: 'queue-section__title' }, ['Recently concluded']),
      el('span', { className: 'queue-section__count' }, [String(sorted.length)]),
    ])
  );

  const body = el('div', { className: 'queue-section__body' });

  if (sorted.length === 0) {
    body.append(
      el('p', { className: 'empty-state queue-section__empty' }, [
        'No completed matches yet — pick a winner on an active match to record results here.',
      ])
    );
    section.append(body);
    return section;
  }

  let currentPage = 0;
  const list = el('div', { className: 'recent-match-list' });
  const pagination = el('nav', {
    className: 'recent-match-pagination',
    'aria-label': 'Recently concluded match pages',
  });

  const renderPage = (): void => {
    const pageData = paginateItems(sorted, currentPage, RECENT_COMPLETED_MATCHES_PAGE_SIZE);
    list.replaceChildren(
      ...pageData.items.map((match) => renderRecentMatchCard(match, players, onUpdateMatch))
    );

    pagination.replaceChildren();
    if (pageData.totalPages <= 1) {
      pagination.append(
        el('p', { className: 'recent-match-pagination__meta' }, [
          `Showing all ${pageData.totalItems} match${pageData.totalItems === 1 ? '' : 'es'}`,
        ])
      );
      return;
    }

    const prevButton = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary recent-match-pagination__btn',
        disabled: pageData.page === 0 ? 'true' : undefined,
      },
      ['Previous']
    ) as HTMLButtonElement;

    const nextButton = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary recent-match-pagination__btn',
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
      el('span', { className: 'recent-match-pagination__meta' }, [
        `Showing ${pageData.rangeStart}–${pageData.rangeEnd} of ${pageData.totalItems} · Page ${pageData.page + 1} of ${pageData.totalPages}`,
      ]),
      nextButton
    );
  };

  if (sorted.length > RECENT_COMPLETED_MATCHES_PAGE_SIZE) {
    body.append(
      el('p', { className: 'recent-match-list__lead' }, [
        `${RECENT_COMPLETED_MATCHES_PAGE_SIZE} matches per page — use Next for older results. Full history is in Stats → Queue analytics.`,
      ])
    );
  }

  renderPage();
  body.append(list, pagination);
  section.append(body);
  return section;
}
