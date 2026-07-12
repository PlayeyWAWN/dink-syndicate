import { el } from '@/lib/dom-utils';
import { formatMatchDuration } from '@/lib/match-timer';
import { pickleballIconHtml } from '@/ui/icons/pickleball-icon';
import { appRouter } from '@/app/router';
import { useQueueStore } from '@/stores/queueStore';
import { useCourtStore } from '@/stores/courtStore';
import { useSettingsUiStore } from '@/stores/settingsUiStore';
import {
  buildAutoPreviewLineups,
  computeStackLineupCount,
  getAllWaitingStackIds,
  getStackStartBlockReason,
  WIN_LOSE_STACK_PLAYERS,
} from '@/modules/game-mode/winLoseStackMode';
import {
  flattenStagedLineups,
  getCompleteStagedLineups,
  useQueueUiStore,
} from '@/stores/queueUiStore';
import { renderRotationControls } from '@/ui/components/RotationControlsPanel';
import { openQueuePlayerEditDialog } from '@/ui/components/QueuePlayerEditDialog';
import { Player } from '@/types/player';
import { isRotationPaused, QueueState } from '@/types/queue';
import { ensureWinLoseStackState } from '@/types/win-lose-stack';

export interface WinLoseStackPanelOptions {
  queueState: QueueState;
  players: Player[];
  openCourtCount: number;
  activeMatchCount: number;
  onNavigate: () => void;
}

interface StackColumnInteraction {
  selectable: boolean;
  allowReorder: boolean;
  selectedPlayerIds: string[];
  onToggleSelect: (playerId: string) => void;
  onReorder: (playerId: string, direction: 'up' | 'down') => void;
}

const LINEUP_SLOT_LABELS = ['Team 1 · A', 'Team 1 · B', 'Team 2 · A', 'Team 2 · B'] as const;

function playerName(players: Player[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.name ?? 'Unknown';
}

function playerAvailableSince(players: Player[], playerId: string): number | undefined {
  return players.find((player) => player.id === playerId)?.availableSince;
}

/** Live wait timer for stack waiters and lineup slots. */
function renderWaitTimer(availableSince: number | undefined): HTMLElement | null {
  if (availableSince == null) return null;
  return el(
    'span',
    {
      className: 'win-lose-stack__wait match-timer',
      'data-available-since': String(availableSince),
      title: 'Time waiting',
    },
    [formatMatchDuration(Date.now() - availableSince)]
  );
}

function pruneManualSelection(eligibleIds: string[]): string[][] {
  const ui = useQueueUiStore.getState();
  ui.pruneStackStagedLineups(eligibleIds);
  return useQueueUiStore.getState().stackStagedLineups;
}

function renderSingleLineupCard(
  lineupIndex: number,
  playerIds: string[],
  players: Player[],
  manualMode: boolean,
  filledAt: number | undefined,
  onEditPlayer: ((lineupIndex: number, playerId: string) => void) | null,
  onClearLineup: (() => void) | null
): HTMLElement {
  const card = el('div', {
    className: 'win-lose-stack__next-lineup',
    role: 'region',
    'aria-label': `Next lineup ${lineupIndex + 1}`,
  });

  const header = el('div', { className: 'win-lose-stack__next-lineup-header' });
  header.append(
    el('h3', { className: 'win-lose-stack__next-lineup-title' }, [
      lineupIndex === 0 ? 'Next lineup' : `Lineup ${lineupIndex + 1}`,
    ]),
    el('span', { className: 'win-lose-stack__next-badge' }, [
      `${playerIds.length}/${WIN_LOSE_STACK_PLAYERS} selected`,
    ])
  );

  if (filledAt != null) {
    header.append(
      el(
        'span',
        {
          className: 'win-lose-stack__lineup-ready-timer match-timer',
          'data-lineup-filled-at': String(filledAt),
          title: 'Time this lineup has been ready',
        },
        [formatMatchDuration(Date.now() - filledAt)]
      )
    );
  }

  if (manualMode && onClearLineup && playerIds.length > 0) {
    const clearBtn = el('button', {
      type: 'button',
      className: 'win-lose-stack__lineup-clear',
    }, ['Clear']) as HTMLButtonElement;
    clearBtn.addEventListener('click', onClearLineup);
    header.append(clearBtn);
  }
  card.append(header);

  const slots = el('div', { className: 'win-lose-stack__lineup-slots' });
  const team1 = el('div', { className: 'win-lose-stack__lineup-team-group' });
  team1.append(
    el('span', { className: 'win-lose-stack__lineup-team-heading win-lose-stack__lineup-team-heading--a' }, [
      'Team 1',
    ]),
    renderLineupSlot(0, playerIds[0], players, lineupIndex, onEditPlayer),
    renderLineupSlot(1, playerIds[1], players, lineupIndex, onEditPlayer)
  );
  const team2 = el('div', { className: 'win-lose-stack__lineup-team-group' });
  team2.append(
    el('span', { className: 'win-lose-stack__lineup-team-heading win-lose-stack__lineup-team-heading--b' }, [
      'Team 2',
    ]),
    renderLineupSlot(2, playerIds[2], players, lineupIndex, onEditPlayer),
    renderLineupSlot(3, playerIds[3], players, lineupIndex, onEditPlayer)
  );
  slots.append(team1, el('div', { className: 'win-lose-stack__lineup-vs' }, ['VS']), team2);
  card.append(slots);
  return card;
}

/** One or more Next Lineup cards above the Winners/Losers columns. */
function renderNextLineupSection(
  stagedLineups: string[][],
  lineupFilledAt: Array<number | undefined>,
  players: Player[],
  manualMode: boolean,
  autoPreviewLineups: string[][],
  onEditPlayer: (lineupIndex: number, playerId: string) => void,
  onClearAll: () => void,
  onClearLineup: (lineupIndex: number) => void
): HTMLElement {
  const section = el('div', {
    className: 'win-lose-stack__next-lineups',
    role: 'region',
    'aria-label': 'Next lineups',
  });

  if (manualMode) {
    const visible = stagedLineups.filter((lineup) => lineup.length > 0);
    if (visible.length === 0) {
      section.append(
        el('p', { className: 'win-lose-stack__next-lineup-hint' }, [
          'Tap waiting players below to build Next lineup. Each group of 4 becomes a lineup — keep tapping to add more lineups.',
        ])
      );
      return section;
    }

    section.append(
      el('p', { className: 'win-lose-stack__next-lineup-hint' }, [
        'Tap a player in a lineup to swap or replace them. Clear removes a lineup.',
      ])
    );
    const clearAll = el('button', {
      type: 'button',
      className: 'win-lose-stack__lineup-clear win-lose-stack__lineup-clear--all',
    }, ['Clear all lineups']) as HTMLButtonElement;
    clearAll.addEventListener('click', onClearAll);
    section.append(clearAll);

    visible.forEach((lineup, index) => {
      section.append(
        renderSingleLineupCard(
          index,
          lineup,
          players,
          true,
          lineupFilledAt[index],
          onEditPlayer,
          () => onClearLineup(index)
        )
      );
    });
    return section;
  }

  const previews = autoPreviewLineups.filter(
    (lineup) => lineup.length >= WIN_LOSE_STACK_PLAYERS
  );
  if (previews.length === 0) {
    section.append(
      el('p', { className: 'win-lose-stack__next-lineup-hint' }, [
        `Need ${WIN_LOSE_STACK_PLAYERS} players in the Next-Up stack before auto-rotation can start.`,
      ])
    );
    return section;
  }

  section.append(
    el('p', { className: 'win-lose-stack__next-lineup-hint' }, [
      'Upcoming games — pairings shown are final (prior partners split when possible).',
    ])
  );
  previews.forEach((lineup, index) => {
    section.append(
      renderSingleLineupCard(
        index,
        lineup,
        players,
        false,
        lineupFilledAt[index],
        null,
        null
      )
    );
  });
  return section;
}

function renderLineupSlot(
  slotIndex: number,
  playerId: string | undefined,
  players: Player[],
  lineupIndex: number,
  onEditPlayer: ((lineupIndex: number, playerId: string) => void) | null
): HTMLElement {
  const isTeam1 = slotIndex < 2;
  const interactive = onEditPlayer != null && playerId != null;
  const slot = el(interactive ? 'button' : 'div', {
    type: interactive ? 'button' : undefined,
    className: [
      'win-lose-stack__lineup-slot',
      isTeam1 ? 'win-lose-stack__lineup-slot--team1' : 'win-lose-stack__lineup-slot--team2',
      playerId ? 'win-lose-stack__lineup-slot--filled' : 'win-lose-stack__lineup-slot--empty',
    ]
      .filter(Boolean)
      .join(' '),
    title: playerId
      ? interactive
        ? `Edit ${playerName(players, playerId)} — swap or replace`
        : playerName(players, playerId)
      : 'Empty slot — tap a waiting player',
    'aria-label': playerId
      ? `${LINEUP_SLOT_LABELS[slotIndex]}: ${playerName(players, playerId)}${
          interactive ? '. Tap to swap or replace.' : ''
        }`
      : `${LINEUP_SLOT_LABELS[slotIndex]}: empty`,
  });

  slot.append(
    el('span', { className: 'win-lose-stack__lineup-slot-label' }, [LINEUP_SLOT_LABELS[slotIndex]!])
  );

  if (playerId) {
    slot.append(
      el('span', { className: 'win-lose-stack__lineup-slot-name' }, [playerName(players, playerId)])
    );
    if (interactive) {
      slot.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onEditPlayer(lineupIndex, playerId);
      });
    }
  } else {
    slot.append(el('span', { className: 'win-lose-stack__lineup-slot-name' }, ['Tap a player']));
  }

  return slot;
}

function renderReorderButton(
  label: string,
  direction: 'up' | 'down',
  playerId: string,
  disabled: boolean,
  onReorder: StackColumnInteraction['onReorder']
): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    className: 'win-lose-stack__reorder-btn',
    title: label,
    'aria-label': label,
    disabled: disabled ? 'true' : undefined,
  }, [direction === 'up' ? '↑' : '↓']) as HTMLButtonElement;

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!disabled) {
      onReorder(playerId, direction);
    }
  });

  return button;
}

function renderStackColumn(
  title: string,
  playerIds: string[],
  players: Player[],
  isNextUp: boolean,
  interaction?: StackColumnInteraction
): HTMLElement {
  const selectable = interaction?.selectable === true;
  const allowReorder = interaction?.allowReorder === true && isNextUp;
  const selectedPlayerIds = interaction?.selectedPlayerIds ?? [];

  const column = el('div', {
    className: `win-lose-stack__column${isNextUp ? ' win-lose-stack__column--next-up' : ''}`,
  });

  const header = el('div', { className: 'win-lose-stack__column-header' }, [
    el('h3', { className: 'win-lose-stack__column-title' }, [title]),
    isNextUp
      ? el('span', { className: 'win-lose-stack__next-badge' }, ['Next-Up'])
      : el('span', { className: 'win-lose-stack__count' }, [String(playerIds.length)]),
  ]);
  column.append(header);

  if (selectable) {
    column.append(
      el('p', { className: 'win-lose-stack__due-hint' }, [
        'Tap a name to move them into Next lineup above.',
      ])
    );
  } else if (isNextUp) {
    column.append(
      el('p', { className: 'win-lose-stack__due-hint' }, [
        playerIds.length >= WIN_LOSE_STACK_PLAYERS
          ? 'Top four will play next when a court opens.'
          : `Need ${WIN_LOSE_STACK_PLAYERS - playerIds.length} more in this stack.`,
      ])
    );
  }

  const list = el('ol', { className: 'win-lose-stack__list' });
  if (playerIds.length === 0) {
    list.append(el('li', { className: 'win-lose-stack__empty' }, ['No players waiting']));
  } else {
    playerIds.forEach((playerId, index) => {
      const name = playerName(players, playerId);
      const isSelected = selectable && selectedPlayerIds.includes(playerId);
      const selectionIndex = isSelected ? selectedPlayerIds.indexOf(playerId) + 1 : 0;

      const itemClasses = [
        'win-lose-stack__item',
        selectable ? 'win-lose-stack__item--selectable' : '',
        isSelected ? 'win-lose-stack__item--selected' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const itemChildren: HTMLElement[] = [
        el('span', { className: 'win-lose-stack__position' }, [
          isSelected ? String(selectionIndex) : String(index + 1),
        ]),
        el('span', { className: 'win-lose-stack__name' }, [name]),
      ];

      const wait = renderWaitTimer(playerAvailableSince(players, playerId));
      if (wait) itemChildren.push(wait);

      if (allowReorder && interaction) {
        const actions = el('div', { className: 'win-lose-stack__item-actions' }, [
          renderReorderButton('Move up', 'up', playerId, index === 0, interaction.onReorder),
          renderReorderButton(
            'Move down',
            'down',
            playerId,
            index === playerIds.length - 1,
            interaction.onReorder
          ),
        ]);
        itemChildren.push(actions);
      }

      const item = el('li', { className: itemClasses }, itemChildren);

      if (selectable && interaction) {
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        item.addEventListener('click', () => {
          interaction.onToggleSelect(playerId);
        });
        item.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            interaction.onToggleSelect(playerId);
          }
        });
      }

      list.append(item);
    });
  }

  column.append(list);
  return column;
}

/** Win/Lose Stack rotation panel — next lineup(s), two stacks, and start control. */
export function renderWinLoseStackPanel(options: WinLoseStackPanelOptions): HTMLElement {
  const { queueState, players, openCourtCount, activeMatchCount, onNavigate } = options;
  const stack = ensureWinLoseStackState(queueState.winLoseStack);
  const manualMode = isRotationPaused(queueState);
  const autoRotationOn = !manualMode;
  const blockReason = getStackStartBlockReason(queueState, openCourtCount, activeMatchCount);

  const eligibleIds = getAllWaitingStackIds(stack);
  const lineupCount = computeStackLineupCount(openCourtCount, eligibleIds.length);
  const stagedLineups = manualMode ? pruneManualSelection(eligibleIds) : [];
  const autoPreviewLineups = !manualMode ? buildAutoPreviewLineups(stack, lineupCount) : [];
  if (!manualMode) {
    useQueueUiStore.getState().syncStackAutoPreviewFilledAt(autoPreviewLineups);
  }
  const lineupFilledAt = manualMode
    ? useQueueUiStore.getState().stackLineupFilledAt
    : useQueueUiStore.getState().stackAutoPreviewFilledAt;
  const selectedPlayerIds = flattenStagedLineups(stagedLineups);
  const stagedSet = new Set(selectedPlayerIds);
  const winnersVisible = stack.winnerStack.filter((id) => !stagedSet.has(id));
  const losersVisible = stack.loserStack.filter((id) => !stagedSet.has(id));
  const completeLineups = getCompleteStagedLineups(stagedLineups);
  const manualReady = completeLineups.length > 0;
  const canStart = blockReason == null && (!manualMode || manualReady);
  const gamesToStart = manualMode
    ? Math.min(openCourtCount, completeLineups.length)
    : Math.min(openCourtCount, autoPreviewLineups.length || 1);

  const openLineupPlayerEditor = (lineupIndex: number, playerId: string): void => {
    const lineupIds = useQueueUiStore.getState().stackStagedLineups[lineupIndex];
    const player = players.find((item) => item.id === playerId);
    if (!lineupIds || !player) return;

    const stagedNow = new Set(flattenStagedLineups(useQueueUiStore.getState().stackStagedLineups));
    const replacementPool = players.filter(
      (item) =>
        eligibleIds.includes(item.id) && !stagedNow.has(item.id) && item.id !== playerId
    );

    openQueuePlayerEditDialog({
      lineup: { format: 'doubles', playerIds: lineupIds },
      player,
      players,
      available: replacementPool,
      replacementPool,
      replaceHint: 'Choose a waiting stack player to replace them. Longest wait at top.',
      onSwap: (otherPlayerId) => {
        useQueueUiStore.getState().swapStagedLineupPlayers(lineupIndex, playerId, otherPlayerId);
        onNavigate();
      },
      onReplace: (newPlayerId) => {
        useQueueUiStore.getState().replaceStagedLineupPlayer(lineupIndex, playerId, newPlayerId);
        onNavigate();
      },
    });
  };

  const makeInteraction = (allowReorder: boolean): StackColumnInteraction => ({
    selectable: true,
    allowReorder,
    selectedPlayerIds: [],
    onToggleSelect: (playerId) => {
      useQueueUiStore.getState().toggleStackSelectedPlayer(playerId, eligibleIds);
      onNavigate();
    },
    onReorder: (playerId, direction) => {
      const ok = useQueueStore.getState().reorderStackPlayer(playerId, direction);
      if (!ok) return;
      onNavigate();
    },
  });

  const section = el('section', { className: 'queue-section queue-section--stacks' });
  const headerRow = el('div', { className: 'queue-section__header win-lose-stack__header' });
  const helpLink = el('button', {
    type: 'button',
    className: 'win-lose-stack__help-link',
    title: 'Open Win/Lose Stack guide in Settings',
  }, ['How it works']);
  helpLink.addEventListener('click', () => {
    useSettingsUiStore.getState().setAppInfoSectionOpen(true);
    appRouter.navigate('settings');
  });
  const waitingVisibleCount = winnersVisible.length + losersVisible.length;
  headerRow.append(
    el('h2', { className: 'queue-section__title' }, ['Win/Lose Stacks']),
    el('span', { className: 'queue-section__count' }, [String(waitingVisibleCount)]),
    helpLink
  );
  section.append(headerRow);

  section.append(renderRotationControls({ onNavigate, mode: 'stack' }));

  section.append(
    renderNextLineupSection(
      stagedLineups,
      lineupFilledAt,
      players,
      manualMode,
      autoPreviewLineups,
      openLineupPlayerEditor,
      () => {
        useQueueUiStore.getState().clearStackSelection();
        onNavigate();
      },
      (lineupIndex) => {
        useQueueUiStore.getState().removeStagedLineup(lineupIndex);
        onNavigate();
      }
    )
  );

  const winnersIsNext = stack.nextUp === 'winners';
  const losersIsNext = stack.nextUp === 'losers';

  const stacksGrid = el('div', { className: 'win-lose-stack__grid' });
  stacksGrid.append(
    renderStackColumn(
      'Winners',
      winnersVisible,
      players,
      winnersIsNext,
      manualMode ? makeInteraction(winnersIsNext) : undefined
    ),
    renderStackColumn(
      'Losers',
      losersVisible,
      players,
      losersIsNext,
      manualMode ? makeInteraction(losersIsNext) : undefined
    )
  );
  section.append(stacksGrid);

  const startLabel =
    gamesToStart > 1 ? `Start ${gamesToStart} games` : 'Start next game';
  const startBtn = el('button', {
    type: 'button',
    className: 'btn btn-success btn-create-match win-lose-stack__start-btn',
    disabled: canStart ? undefined : 'true',
  }) as HTMLButtonElement;
  startBtn.innerHTML = `${pickleballIconHtml()}<span>${startLabel}</span>`;

  startBtn.addEventListener('click', () => {
    const courts = useCourtStore.getState().courts;
    const liveState = useQueueStore.getState().queueState;
    const openCourts = courts.filter((court) => !court.activeMatchId);
    const liveBlock = getStackStartBlockReason(
      liveState,
      openCourts.length,
      liveState.activeMatches.length
    );

    if (liveBlock) {
      alert(liveBlock);
      onNavigate();
      return;
    }

    if (openCourts.length === 0) {
      alert('All courts are occupied. Finish a match first.');
      onNavigate();
      return;
    }

    const manual = isRotationPaused(liveState);
    if (manual) {
      const complete = getCompleteStagedLineups(useQueueUiStore.getState().stackStagedLineups);
      if (complete.length === 0) {
        alert(`Fill at least one lineup with ${WIN_LOSE_STACK_PLAYERS} players before starting.`);
        onNavigate();
        return;
      }

      let startedCount = 0;
      const toStart = Math.min(openCourts.length, complete.length);
      for (let i = 0; i < toStart; i++) {
        const court = openCourts[i];
        const lineup = complete[i];
        if (!court || !lineup) break;
        const started = useQueueStore.getState().tryStartWinLoseStackMatch(court.id, {
          manual: true,
          playerIds: lineup,
        });
        if (!started) break;
        startedCount += 1;
      }

      if (startedCount === 0) {
        alert(
          `Could not start a game. Need ${WIN_LOSE_STACK_PLAYERS} players in Next lineup and an open court.`
        );
      }
      onNavigate();
      return;
    }

    const started = useQueueStore.getState().tryStartWinLoseStackMatch(openCourts[0]!.id, {
      manual: false,
    });
    if (!started) {
      alert(
        `Could not start a game. Need ${WIN_LOSE_STACK_PLAYERS} players in the Next-Up stack and an open court.`
      );
    }
    onNavigate();
  });

  const stickyDock = el('div', {
    className: 'win-lose-stack__sticky-dock',
    role: 'region',
    'aria-label': 'Start next game',
  });
  if (blockReason) {
    stickyDock.append(
      el('p', {
        className: 'win-lose-stack__sticky-status win-lose-stack__sticky-status--blocked',
        role: 'status',
      }, [blockReason])
    );
  } else if (manualMode && !manualReady) {
    const firstIncomplete = stagedLineups.find((lineup) => lineup.length < WIN_LOSE_STACK_PLAYERS);
    const statusText =
      stagedLineups.length === 0
        ? 'Tap players below to build Next lineup.'
        : `Select ${WIN_LOSE_STACK_PLAYERS - (firstIncomplete?.length ?? 0)} more player${
            WIN_LOSE_STACK_PLAYERS - (firstIncomplete?.length ?? 0) === 1 ? '' : 's'
          } to complete the next lineup.`;
    stickyDock.append(
      el('p', {
        className: 'win-lose-stack__sticky-status',
        role: 'status',
      }, [statusText])
    );
  } else if (manualMode && gamesToStart > 1) {
    stickyDock.append(
      el('p', { className: 'win-lose-stack__sticky-status', role: 'status' }, [
        `${completeLineups.length} lineup${completeLineups.length === 1 ? '' : 's'} ready — will start ${gamesToStart} on open courts.`,
      ])
    );
  } else if (activeMatchCount > 0 && autoRotationOn) {
    stickyDock.append(
      el('p', { className: 'win-lose-stack__sticky-status', role: 'status' }, [
        'Recording a winner auto-starts the next game when the Next-Up stack has four players.',
      ])
    );
  }
  stickyDock.append(startBtn);
  section.append(stickyDock);
  section.append(el('div', { className: 'win-lose-stack__sticky-spacer', 'aria-hidden': 'true' }));

  return section;
}
