import { el } from '@/lib/dom-utils';
import { formatMatchDuration } from '@/lib/match-timer';
import { formatDuprRating } from '@/lib/format-utils';
import { filterPlayersBySearch } from '@/lib/queue-player-search';
import { renderQueuePlayerSearch } from '@/ui/components/QueuePlayerSearch';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { isPlayerPaused, Player } from '@/types/player';

export type ExcludedPlayerReason = 'not_checked_in' | 'paused' | 'excluded';

export interface ExcludedPlayersPanelOptions {
  onCheckIn?: (playerId: string) => void;
  onReturnFromBreak?: (playerId: string) => void;
  onInclude?: (playerId: string) => void;
}

export function getExcludedPlayerReason(player: Player, now = Date.now()): ExcludedPlayerReason {
  if (player.excluded) return 'excluded';
  if (isPlayerPaused(player, now)) return 'paused';
  return 'not_checked_in';
}

function reasonLabel(reason: ExcludedPlayerReason): string {
  switch (reason) {
    case 'excluded':
      return 'Excluded';
    case 'paused':
      return 'On break';
    default:
      return 'Not checked in';
  }
}

function renderExcludedPlayersGrid(
  gridHost: HTMLElement,
  players: Player[],
  options: ExcludedPlayersPanelOptions
): void {
  const { onCheckIn, onReturnFromBreak, onInclude } = options;
  gridHost.replaceChildren();

  if (players.length === 0) {
    const query = useQueueUiStore.getState().excludedSearchQuery.trim();
    gridHost.append(
      el('p', { className: 'empty-state' }, [
        query
          ? 'No excluded players match your search.'
          : 'Everyone on the roster is available or currently playing.',
      ])
    );
    return;
  }

  const grid = el('div', { className: 'excluded-players-grid' });
  const now = Date.now();

  for (const player of players) {
    const reason = getExcludedPlayerReason(player, now);
    const card = el('article', {
      className: [
        'excluded-player-card',
        `excluded-player-card--${player.gender}`,
        `excluded-player-card--${reason}`,
      ].join(' '),
    });

    const genderLabel = player.gender === 'female' ? 'F' : 'M';
    const top = el('div', { className: 'excluded-player-card__top' });
    top.append(
      el('span', { className: 'excluded-player-card__gender' }, [genderLabel]),
      el('strong', { className: 'excluded-player-card__name' }, [player.name])
    );

    const reasonBadge = el('span', {
      className: `excluded-player-card__reason excluded-player-card__reason--${reason}`,
    });

    if (reason === 'paused' && player.pausedUntil != null) {
      reasonBadge.append(
        'On break · ',
        el('span', {
          className: 'excluded-player-card__countdown match-timer',
          'data-paused-until': String(player.pausedUntil),
        }, [formatMatchDuration(Math.max(0, player.pausedUntil - now))])
      );
    } else {
      reasonBadge.textContent = reasonLabel(reason);
    }

    card.append(
      top,
      reasonBadge,
      el('div', { className: 'excluded-player-card__meta' }, [
        el('span', {}, [`${player.gamesPlayed} games`]),
        el('span', {}, [`DUPR ${formatDuprRating(player.dupr.duprDoublesRating)}`]),
      ])
    );

    const actions = el('div', { className: 'excluded-player-card__actions' });
    if (reason === 'not_checked_in' && onCheckIn) {
      const btn = el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
      }, ['Check in']);
      btn.addEventListener('click', () => onCheckIn(player.id));
      actions.append(btn);
    } else if (reason === 'paused' && onReturnFromBreak) {
      const btn = el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
      }, ['Return now']);
      btn.addEventListener('click', () => onReturnFromBreak(player.id));
      actions.append(btn);
    } else if (reason === 'excluded' && onInclude) {
      const btn = el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
      }, ['Include']);
      btn.addEventListener('click', () => onInclude(player.id));
      actions.append(btn);
    }

    if (actions.childElementCount > 0) {
      card.append(actions);
    }

    grid.append(card);
  }

  gridHost.append(grid);
}

export function renderExcludedPlayersPanel(
  players: Player[],
  options: ExcludedPlayersPanelOptions = {}
): HTMLElement {
  const ui = useQueueUiStore.getState();
  const searchQuery = ui.excludedSearchQuery;
  const sectionOpen = ui.excludedSectionOpen;

  const section = el('section', { className: 'queue-section queue-section--excluded' });

  const details = el('details', {
    className: 'queue-section-accordion',
    ...(sectionOpen ? { open: 'true' } : {}),
  });

  details.addEventListener('toggle', () => {
    useQueueUiStore.getState().setExcludedSectionOpen(details.open);
  });

  const summary = el('summary', { className: 'queue-section-accordion__toggle' });
  const summaryMain = el('div', { className: 'queue-section-accordion__summary-main' });
  summaryMain.append(
    el('span', { className: 'queue-section-accordion__chevron', 'aria-hidden': 'true' }),
    el('span', { className: 'queue-section-accordion__title' }, [
      el('strong', {}, ['Excluded Players']),
      el('span', { className: 'queue-section-accordion__count-badge' }, [
        String(players.length),
      ]),
    ]),
    el('span', { className: 'queue-section-accordion__collapsed-hint' }, [
      'Player list is hidden — tap header to show',
    ])
  );
  summary.append(summaryMain);

  const body = el('div', { className: 'queue-section-accordion__body' });
  body.append(
    el('p', { className: 'queue-section-accordion__hint' }, [
      'Not checked in, on a break, or excluded from today\'s session.',
    ])
  );

  const gridHost = el('div', { className: 'queue-section-accordion__grid-host' });

  const refreshGrid = (): void => {
    const query = useQueueUiStore.getState().excludedSearchQuery;
    const visible = filterPlayersBySearch(players, query);
    renderExcludedPlayersGrid(gridHost, visible, options);
  };

  if (players.length > 0) {
    body.append(
      renderQueuePlayerSearch({
        inputId: 'queue-excluded-search',
        label: 'Search',
        value: searchQuery,
        onInput: (query) => {
          useQueueUiStore.getState().setExcludedSearchQuery(query);
          refreshGrid();
        },
      })
    );
  }

  refreshGrid();
  body.append(gridHost);

  details.append(summary, body);
  section.append(details);
  return section;
}
