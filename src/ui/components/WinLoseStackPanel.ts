import { el } from '@/lib/dom-utils';
import { pickleballIconHtml } from '@/ui/icons/pickleball-icon';
import { useQueueStore } from '@/stores/queueStore';
import { useCourtStore } from '@/stores/courtStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { useSettingsUiStore } from '@/stores/settingsUiStore';
import { appRouter } from '@/app/router';
import { Player } from '@/types/player';
import { isRotationPaused, QueueState } from '@/types/queue';
import { renderRotationControls } from '@/ui/components/RotationControlsPanel';
import { ensureWinLoseStackState } from '@/types/win-lose-stack';
import {
  getAllWaitingStackIds,
  getNextUpStackIds,
  getStackStartBlockReason,
  WIN_LOSE_STACK_PLAYERS,
} from '@/modules/game-mode/winLoseStackMode';

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

function pruneManualSelection(eligibleIds: string[]): string[] {
  const ui = useQueueUiStore.getState();
  const valid = ui.stackSelectedPlayerIds.filter((id) => eligibleIds.includes(id));
  if (valid.length !== ui.stackSelectedPlayerIds.length) {
    ui.setStackSelectedPlayerIds(valid);
  }
  return valid;
}

function renderLineupSlot(
  index: number,
  playerId: string | undefined,
  players: Player[],
  onClear: (playerId: string) => void
): HTMLElement {
  const isTeam1 = index < 2;
  const slot = el('button', {
    type: 'button',
    className: [
      'win-lose-stack__lineup-slot',
      isTeam1 ? 'win-lose-stack__lineup-slot--team1' : 'win-lose-stack__lineup-slot--team2',
      playerId ? 'win-lose-stack__lineup-slot--filled' : 'win-lose-stack__lineup-slot--empty',
    ]
      .filter(Boolean)
      .join(' '),
    title: playerId ? `Remove ${playerName(players, playerId)}` : 'Empty slot — tap a waiting player',
    'aria-label': playerId
      ? `${LINEUP_SLOT_LABELS[index]}: ${playerName(players, playerId)}. Tap to remove.`
      : `${LINEUP_SLOT_LABELS[index]}: empty`,
  });

  slot.append(
    el('span', { className: 'win-lose-stack__lineup-slot-label' }, [LINEUP_SLOT_LABELS[index]!])
  );

  if (playerId) {
    slot.append(
      el('span', { className: 'win-lose-stack__lineup-slot-name' }, [playerName(players, playerId)])
    );
    slot.addEventListener('click', () => onClear(playerId));
  } else {
    slot.append(el('span', { className: 'win-lose-stack__lineup-slot-name' }, ['Tap a player']));
  }

  return slot;
}

/** Standalone Next Lineup section above the Winners/Losers columns. */
function renderNextLineupSection(
  selectedPlayerIds: string[],
  players: Player[],
  manualMode: boolean,
  autoPreviewIds: string[],
  onClearPlayer: (playerId: string) => void,
  onClearAll: () => void
): HTMLElement {
  const section = el('div', {
    className: 'win-lose-stack__next-lineup',
    role: 'region',
    'aria-label': 'Next lineup',
  });

  const header = el('div', { className: 'win-lose-stack__next-lineup-header' });
  header.append(el('h3', { className: 'win-lose-stack__next-lineup-title' }, ['Next lineup']));

  if (manualMode) {
    header.append(
      el('span', { className: 'win-lose-stack__next-badge' }, [
        `${selectedPlayerIds.length}/${WIN_LOSE_STACK_PLAYERS} selected`,
      ])
    );
    if (selectedPlayerIds.length > 0) {
      const clearBtn = el('button', {
        type: 'button',
        className: 'win-lose-stack__lineup-clear',
      }, ['Clear']) as HTMLButtonElement;
      clearBtn.addEventListener('click', onClearAll);
      header.append(clearBtn);
    }
  } else {
    header.append(
      el('span', { className: 'win-lose-stack__next-badge' }, [
        autoPreviewIds.length >= WIN_LOSE_STACK_PLAYERS
          ? `Top ${WIN_LOSE_STACK_PLAYERS}`
          : `${autoPreviewIds.length}/${WIN_LOSE_STACK_PLAYERS}`,
      ])
    );
  }
  section.append(header);

  if (manualMode) {
    section.append(
      el('p', { className: 'win-lose-stack__next-lineup-hint' }, [
        'Tap waiting players below to fill slots in order (Team 1, then Team 2). Tap a filled slot or name again to remove. With 4 selected, tapping another player replaces the last slot.',
      ])
    );

    const slots = el('div', { className: 'win-lose-stack__lineup-slots' });
    const team1 = el('div', { className: 'win-lose-stack__lineup-team-group' });
    team1.append(
      el('span', { className: 'win-lose-stack__lineup-team-heading win-lose-stack__lineup-team-heading--a' }, [
        'Team 1',
      ]),
      renderLineupSlot(0, selectedPlayerIds[0], players, onClearPlayer),
      renderLineupSlot(1, selectedPlayerIds[1], players, onClearPlayer)
    );
    const team2 = el('div', { className: 'win-lose-stack__lineup-team-group' });
    team2.append(
      el('span', { className: 'win-lose-stack__lineup-team-heading win-lose-stack__lineup-team-heading--b' }, [
        'Team 2',
      ]),
      renderLineupSlot(2, selectedPlayerIds[2], players, onClearPlayer),
      renderLineupSlot(3, selectedPlayerIds[3], players, onClearPlayer)
    );
    slots.append(team1, el('div', { className: 'win-lose-stack__lineup-vs' }, ['VS']), team2);
    section.append(slots);
  } else if (autoPreviewIds.length >= WIN_LOSE_STACK_PLAYERS) {
    const slots = el('div', { className: 'win-lose-stack__lineup-slots' });
    const team1 = el('div', { className: 'win-lose-stack__lineup-team-group' });
    team1.append(
      el('span', { className: 'win-lose-stack__lineup-team-heading win-lose-stack__lineup-team-heading--a' }, [
        'Team 1',
      ]),
      el('div', { className: 'win-lose-stack__lineup-slot win-lose-stack__lineup-slot--team1 win-lose-stack__lineup-slot--filled' }, [
        el('span', { className: 'win-lose-stack__lineup-slot-name' }, [
          `${playerName(players, autoPreviewIds[0]!)} & ${playerName(players, autoPreviewIds[1]!)}`,
        ]),
      ])
    );
    const team2 = el('div', { className: 'win-lose-stack__lineup-team-group' });
    team2.append(
      el('span', { className: 'win-lose-stack__lineup-team-heading win-lose-stack__lineup-team-heading--b' }, [
        'Team 2',
      ]),
      el('div', { className: 'win-lose-stack__lineup-slot win-lose-stack__lineup-slot--team2 win-lose-stack__lineup-slot--filled' }, [
        el('span', { className: 'win-lose-stack__lineup-slot-name' }, [
          `${playerName(players, autoPreviewIds[2]!)} & ${playerName(players, autoPreviewIds[3]!)}`,
        ]),
      ])
    );
    slots.append(team1, el('div', { className: 'win-lose-stack__lineup-vs' }, ['VS']), team2);
    section.append(slots);
    section.append(
      el('p', { className: 'win-lose-stack__next-lineup-hint' }, [
        'Auto-rotation will start these four when a court opens (partners may shuffle).',
      ])
    );
  } else {
    section.append(
      el('p', { className: 'win-lose-stack__next-lineup-hint' }, [
        `Need ${WIN_LOSE_STACK_PLAYERS} players in the Next-Up stack before auto-rotation can start.`,
      ])
    );
  }

  return section;
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
        'Tap a name to add or remove them from Next lineup above.',
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

/** Win/Lose Stack rotation panel — next lineup, two stacks, and start control. */
export function renderWinLoseStackPanel(options: WinLoseStackPanelOptions): HTMLElement {
  const { queueState, players, openCourtCount, activeMatchCount, onNavigate } = options;
  const stack = ensureWinLoseStackState(queueState.winLoseStack);
  const manualMode = isRotationPaused(queueState);
  const autoRotationOn = !manualMode;
  const blockReason = getStackStartBlockReason(queueState, openCourtCount, activeMatchCount);

  const eligibleIds = getAllWaitingStackIds(stack);
  const selectedPlayerIds = manualMode ? pruneManualSelection(eligibleIds) : [];
  const autoPreviewIds = !manualMode ? getNextUpStackIds(stack).slice(0, WIN_LOSE_STACK_PLAYERS) : [];
  const manualReady = selectedPlayerIds.length === WIN_LOSE_STACK_PLAYERS;
  const canStart = blockReason == null && (!manualMode || manualReady);

  const makeInteraction = (allowReorder: boolean): StackColumnInteraction => ({
    selectable: true,
    allowReorder,
    selectedPlayerIds,
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
  headerRow.append(
    el('h2', { className: 'queue-section__title' }, ['Win/Lose Stacks']),
    el('span', { className: 'queue-section__count' }, [
      String(stack.winnerStack.length + stack.loserStack.length),
    ]),
    helpLink
  );
  section.append(headerRow);

  section.append(renderRotationControls({ onNavigate, mode: 'stack' }));

  section.append(
    renderNextLineupSection(
      selectedPlayerIds,
      players,
      manualMode,
      autoPreviewIds,
      (playerId) => {
        useQueueUiStore.getState().toggleStackSelectedPlayer(playerId, eligibleIds);
        onNavigate();
      },
      () => {
        useQueueUiStore.getState().clearStackSelection();
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
      stack.winnerStack,
      players,
      winnersIsNext,
      manualMode ? makeInteraction(winnersIsNext) : undefined
    ),
    renderStackColumn(
      'Losers',
      stack.loserStack,
      players,
      losersIsNext,
      manualMode ? makeInteraction(losersIsNext) : undefined
    )
  );
  section.append(stacksGrid);

  const startBtn = el('button', {
    type: 'button',
    className: 'btn btn-success btn-create-match win-lose-stack__start-btn',
    disabled: canStart ? undefined : 'true',
  }) as HTMLButtonElement;
  startBtn.innerHTML = `${pickleballIconHtml()}<span>Start next game</span>`;

  startBtn.addEventListener('click', () => {
    const courts = useCourtStore.getState().courts;
    const openCourt = courts.find((court) => !court.activeMatchId);
    const liveState = useQueueStore.getState().queueState;
    const liveBlock = getStackStartBlockReason(
      liveState,
      courts.filter((court) => !court.activeMatchId).length,
      liveState.activeMatches.length
    );

    if (liveBlock) {
      alert(liveBlock);
      onNavigate();
      return;
    }

    if (!openCourt) {
      alert('All courts are occupied. Finish a match first.');
      onNavigate();
      return;
    }

    if (isRotationPaused(liveState)) {
      const selected = useQueueUiStore.getState().stackSelectedPlayerIds;
      if (selected.length !== WIN_LOSE_STACK_PLAYERS) {
        alert(`Pick exactly ${WIN_LOSE_STACK_PLAYERS} players in Next lineup before starting.`);
        onNavigate();
        return;
      }
    }

    const started = useQueueStore
      .getState()
      .tryStartWinLoseStackMatch(openCourt.id, { manual: isRotationPaused(liveState) });
    if (!started) {
      alert(
        `Could not start a game. Need ${WIN_LOSE_STACK_PLAYERS} players in Next lineup and an open court.`
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
    stickyDock.append(
      el('p', {
        className: 'win-lose-stack__sticky-status',
        role: 'status',
      }, [
        `Select ${WIN_LOSE_STACK_PLAYERS - selectedPlayerIds.length} more player${
          WIN_LOSE_STACK_PLAYERS - selectedPlayerIds.length === 1 ? '' : 's'
        } in Next lineup.`,
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
