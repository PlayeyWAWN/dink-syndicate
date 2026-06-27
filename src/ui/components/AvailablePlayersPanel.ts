import { el } from '@/lib/dom-utils';
import { formatMatchDuration } from '@/lib/match-timer';
import { formatDuprRating } from '@/lib/format-utils';
import { filterPlayersBySearch } from '@/lib/queue-player-search';
import { createAppIcon, genderAppIconId, mountAppIcon } from '@/ui/icons/app-icons';
import { playerActionIconHtml } from '@/ui/icons/player-action-icons';
import { renderQueuePlayerSearch } from '@/ui/components/QueuePlayerSearch';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { getSynergyPartnerName } from '@/ui/components/SynergyTeamModal';
import { Player } from '@/types/player';

export interface AvailablePlayersPanelOptions {
  waitThresholds?: { warnMinutes: number; criticalMinutes: number };
  selectedPlayerIds?: string[];
  requiredCount?: number;
  synergyPairs?: Array<[string, string]>;
  synergyTeamsEnabled?: boolean;
  rosterPlayers?: Player[];
  onPlayerTap?: (playerId: string) => void;
  onPausePlayer?: (playerId: string) => void;
  onClearSelection?: () => void;
  onBuildManualMatch?: () => void;
}

function renderAvailablePlayersGrid(
  gridHost: HTMLElement,
  players: Player[],
  options: Required<
    Pick<AvailablePlayersPanelOptions, 'selectedPlayerIds' | 'requiredCount'>
  > &
    Pick<
      AvailablePlayersPanelOptions,
      'onPlayerTap' | 'onPausePlayer' | 'synergyPairs' | 'synergyTeamsEnabled' | 'rosterPlayers'
    >
): void {
  const {
    selectedPlayerIds = [],
    onPlayerTap,
    onPausePlayer,
    synergyPairs = [],
    synergyTeamsEnabled = false,
    rosterPlayers = players,
  } = options;
  const selectedSet = new Set(selectedPlayerIds);
  const manualMode = Boolean(onPlayerTap);

  gridHost.replaceChildren();

  if (players.length === 0) {
    const query = useQueueUiStore.getState().availableSearchQuery.trim();
    gridHost.append(
      el('p', { className: 'empty-state' }, [
        query
          ? 'No available players match your search.'
          : 'No available players — all are queued or on court.',
      ])
    );
    return;
  }

  const grid = el('div', { className: 'available-players-grid' });
  for (const player of players) {
    const availableSince = player.availableSince ?? Date.now();
    const isSelected = selectedSet.has(player.id);
    const card = el('article', {
      className: [
        'available-player-card',
        `available-player-card--${player.gender}`,
        isSelected ? 'available-player-card--selected' : '',
        manualMode ? 'available-player-card--selectable' : '',
        onPausePlayer ? 'available-player-card--has-pause' : '',
      ]
        .filter(Boolean)
        .join(' '),
      ...(manualMode
        ? {
            role: 'button',
            tabindex: '0',
            'aria-pressed': isSelected ? 'true' : 'false',
          }
        : {}),
    });
    const top = el('div', { className: 'available-player-card__top' });
    if (isSelected) {
      top.append(createAppIcon('check', 'available-player-card__selected-mark'));
    }
    const avatar = el('span', {
      className: `available-player-card__avatar available-player-card__avatar--${player.gender}`,
      'aria-hidden': 'true',
    });
    mountAppIcon(avatar, genderAppIconId(player.gender));
    top.append(
      avatar,
      el('strong', { className: 'available-player-card__name' }, [player.name])
    );

    const partnerName =
      synergyTeamsEnabled && getSynergyPartnerName(player.id, rosterPlayers, synergyPairs);
    if (partnerName) {
      const synergyMark = el('span', {
        className: 'available-player-card__synergy-mark',
        title: `Synergy partner: ${partnerName}`,
        role: 'img',
        'aria-label': `Synergy partner: ${partnerName}`,
      });
      mountAppIcon(synergyMark, 'synergy');
      top.append(synergyMark);
    }

    top.append(
      el('span', {
        className: 'available-player-card__wait match-timer',
        'data-available-since': String(availableSince),
        title: 'Time waiting to be queued',
      }, [formatMatchDuration(Date.now() - availableSince)])
    );

    if (onPausePlayer) {
      const pauseBtn = el('button', {
        type: 'button',
        className: 'available-player-card__pause-btn',
        title: 'Take a break',
        'aria-label': `Take a break — ${player.name}`,
      }) as HTMLButtonElement;
      pauseBtn.innerHTML = playerActionIconHtml('pause');
      pauseBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        onPausePlayer(player.id);
      });
      card.append(top, pauseBtn);
    } else {
      card.append(top);
    }

    card.append(
      el('div', { className: 'available-player-card__meta' }, [
        el('span', {}, [`${player.gamesPlayed} games`]),
        el('span', {}, [`DUPR ${formatDuprRating(player.dupr.duprDoublesRating)}`]),
      ])
    );

    if (manualMode && onPlayerTap) {
      const activate = () => onPlayerTap(player.id);
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
    }

    grid.append(card);
  }

  gridHost.append(grid);
}

export function renderAvailablePlayersPanel(
  players: Player[],
  createMatchButton?: HTMLElement,
  options: AvailablePlayersPanelOptions = {}
): HTMLElement {
  const {
    waitThresholds,
    selectedPlayerIds = [],
    requiredCount = 4,
    synergyPairs = [],
    synergyTeamsEnabled = false,
    rosterPlayers = [],
    onPlayerTap,
    onPausePlayer,
    onClearSelection,
    onBuildManualMatch,
  } = options;
  const manualMode = Boolean(onPlayerTap);
  const canBuild = selectedPlayerIds.length === requiredCount && Boolean(onBuildManualMatch);
  const ui = useQueueUiStore.getState();
  const searchQuery = ui.availableSearchQuery;

  const section = el('section', { className: 'queue-section queue-section--available' });

  const details = el('details', {
    className: 'queue-section-accordion',
    ...(ui.availableSectionOpen ? { open: 'true' } : {}),
  });

  details.addEventListener('toggle', () => {
    useQueueUiStore.getState().setAvailableSectionOpen(details.open);
  });

  const summary = el('summary', { className: 'queue-section-accordion__toggle' });
  const summaryMain = el('div', { className: 'queue-section-accordion__summary-main' });
  summaryMain.append(
    el('span', { className: 'queue-section-accordion__chevron', 'aria-hidden': 'true' }),
    el('span', { className: 'queue-section-accordion__title' }, [
      el('strong', {}, ['Available Players']),
      el('span', { className: 'queue-section-accordion__count-badge' }, [
        `${players.length} available`,
      ]),
    ]),
    el('span', { className: 'queue-section-accordion__collapsed-hint' }, [
      'Player list is hidden — tap header to show',
    ])
  );
  summary.append(summaryMain);

  if (createMatchButton) {
    createMatchButton.classList.add('queue-section-accordion__action');
    createMatchButton.addEventListener('click', (event) => event.stopPropagation());
    summary.append(createMatchButton);
  }

  const body = el('div', { className: 'queue-section-accordion__body' });
  const warnMin = waitThresholds?.warnMinutes ?? 10;
  const criticalMin = waitThresholds?.criticalMinutes ?? 15;
  body.append(
    el('p', { className: 'queue-section-accordion__hint' }, [
      manualMode
        ? `Tap players to build a manual match (${requiredCount} needed). Selected players show a check mark and cyan ring — wait timers stay visible but no longer pulse while selected.`
        : `Checked-in players waiting to be queued. Timers show how long each player has been waiting — orange at ${warnMin}m, red glow at ${criticalMin}m+.`,
    ])
  );

  if (manualMode && selectedPlayerIds.length > 0) {
    const bar = el('div', { className: 'manual-match-bar' });
    const barMain = el('div', { className: 'manual-match-bar__main' });
    barMain.append(
      el('span', { className: 'manual-match-bar__count' }, [
        `${selectedPlayerIds.length}/${requiredCount} selected`,
      ])
    );
    const selectedNames = selectedPlayerIds
      .map((id) => players.find((player) => player.id === id)?.name)
      .filter(Boolean) as string[];
    if (selectedNames.length > 0) {
      const chips = el('div', { className: 'manual-match-bar__chips' });
      for (const name of selectedNames) {
        chips.append(
          el('span', { className: 'manual-match-bar__chip' }, [
            createAppIcon('check', 'manual-match-bar__chip-check'),
            name,
          ])
        );
      }
      barMain.append(chips);
    }
    bar.append(barMain);
    const actions = el('div', { className: 'manual-match-bar__actions' });
    if (onClearSelection) {
      const clearBtn = el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
      }, ['Clear']);
      clearBtn.addEventListener('click', onClearSelection);
      actions.append(clearBtn);
    }
    if (onBuildManualMatch) {
      const buildBtn = el('button', {
        type: 'button',
        className: 'btn btn-success btn-sm',
        disabled: canBuild ? undefined : 'true',
      }, ['Build match']);
      buildBtn.addEventListener('click', onBuildManualMatch);
      actions.append(buildBtn);
    }
    bar.append(actions);
    body.append(bar);
  }

  const gridHost = el('div', { className: 'queue-section-accordion__grid-host' });

  const gridOptions = {
    selectedPlayerIds,
    requiredCount,
    synergyPairs,
    synergyTeamsEnabled,
    rosterPlayers: rosterPlayers.length > 0 ? rosterPlayers : players,
    onPlayerTap,
    onPausePlayer,
  };

  const refreshGrid = (): void => {
    const query = useQueueUiStore.getState().availableSearchQuery;
    const visible = filterPlayersBySearch(players, query);
    renderAvailablePlayersGrid(gridHost, visible, gridOptions);
  };

  if (players.length > 0) {
    body.append(
      renderQueuePlayerSearch({
        inputId: 'queue-available-search',
        label: 'Search',
        value: searchQuery,
        onInput: (query) => {
          useQueueUiStore.getState().setAvailableSearchQuery(query);
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
