import { el } from '@/lib/dom-utils';
import { splitTeams } from '@/lib/format-utils';
import { pickleballIconHtml } from '@/ui/icons/pickleball-icon';
import { partnerSplitPairing } from '@/modules/game-mode/partnerSplit';
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
  getDefaultStackSelection,
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
  manualMode: boolean;
  /** When true, this column participates in selection (manual: both stacks). */
  selectable: boolean;
  /** When true, show reorder arrows (Next-Up column only). */
  allowReorder: boolean;
  selectedPlayerIds: string[];
  onToggleSelect: (playerId: string) => void;
  onReorder: (playerId: string, direction: 'up' | 'down') => void;
}

function playerName(players: Player[], playerId: string): string {
  return players.find((player) => player.id === playerId)?.name ?? 'Unknown';
}

function getLineupPreviewIds(
  selectedPlayerIds: string[],
  manualMode: boolean,
  eligibleIds: string[]
): string[] {
  if (eligibleIds.length < WIN_LOSE_STACK_PLAYERS) {
    return eligibleIds.slice(0, WIN_LOSE_STACK_PLAYERS);
  }

  if (
    manualMode &&
    selectedPlayerIds.length === WIN_LOSE_STACK_PLAYERS &&
    selectedPlayerIds.every((id) => eligibleIds.includes(id))
  ) {
    const selectedSet = new Set(selectedPlayerIds);
    return eligibleIds.filter((id) => selectedSet.has(id));
  }

  return eligibleIds.slice(0, WIN_LOSE_STACK_PLAYERS);
}

function renderNextLineupPreview(
  duePlayerIds: string[],
  players: Player[],
  lastPartnerByPlayer: Record<string, string>
): HTMLElement {
  const { playerIds, hadPartnerConflict } = partnerSplitPairing(
    duePlayerIds,
    lastPartnerByPlayer
  );
  const { teamA, teamB } = splitTeams(playerIds);

  const lineup = el('div', { className: 'win-lose-stack__lineup' });
  lineup.append(el('p', { className: 'win-lose-stack__lineup-title' }, ['Next lineup']));

  lineup.append(
    el('div', { className: 'win-lose-stack__lineup-team win-lose-stack__lineup-team--a' }, [
      el('span', { className: 'win-lose-stack__lineup-label' }, ['Team 1']),
      el('span', { className: 'win-lose-stack__lineup-names' }, [
        `${playerName(players, teamA[0]!)} & ${playerName(players, teamA[1]!)}`,
      ]),
    ]),
    el('div', { className: 'win-lose-stack__lineup-vs' }, ['VS']),
    el('div', { className: 'win-lose-stack__lineup-team win-lose-stack__lineup-team--b' }, [
      el('span', { className: 'win-lose-stack__lineup-label' }, ['Team 2']),
      el('span', { className: 'win-lose-stack__lineup-names' }, [
        `${playerName(players, teamB[0]!)} & ${playerName(players, teamB[1]!)}`,
      ]),
    ])
  );

  if (hadPartnerConflict) {
    lineup.append(
      el('p', { className: 'win-lose-stack__lineup-note' }, [
        'Prior partners could not all be split — lineup may adjust when the game starts.',
      ])
    );
  }

  return lineup;
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
  lastPartnerByPlayer: Record<string, string> = {},
  interaction?: StackColumnInteraction,
  lineupEligibleIds: string[] = playerIds,
  totalSelectedCount = 0,
  crossStackManual = false
): HTMLElement {
  const selectable = interaction?.selectable === true;
  const allowReorder = interaction?.allowReorder === true && isNextUp;
  const selectedPlayerIds = interaction?.selectedPlayerIds ?? [];

  const column = el('div', {
    className: `win-lose-stack__column${isNextUp ? ' win-lose-stack__column--next-up' : ''}`,
  });

  const dueCount = isNextUp
    ? Math.min(playerIds.length, WIN_LOSE_STACK_PLAYERS)
    : 0;

  const header = el('div', { className: 'win-lose-stack__column-header' }, [
    el('h3', { className: 'win-lose-stack__column-title' }, [title]),
    isNextUp
      ? el('span', { className: 'win-lose-stack__next-badge' }, [
          interaction?.manualMode && lineupEligibleIds.length >= WIN_LOSE_STACK_PLAYERS
            ? `Next game · ${totalSelectedCount}/${WIN_LOSE_STACK_PLAYERS} selected`
            : dueCount >= WIN_LOSE_STACK_PLAYERS
              ? `Next game · top ${WIN_LOSE_STACK_PLAYERS}`
              : `Next game · ${dueCount}/${WIN_LOSE_STACK_PLAYERS}`,
        ])
      : el('span', { className: 'win-lose-stack__count' }, [String(playerIds.length)]),
  ]);
  column.append(header);

  if (isNextUp && (dueCount > 0 || (crossStackManual && selectable))) {
    column.append(
      el('p', { className: 'win-lose-stack__due-hint' }, [
        crossStackManual && selectable
          ? 'Tap any waiting players across both stacks (up to 4). Use arrows to reorder this stack.'
          : dueCount >= WIN_LOSE_STACK_PLAYERS
            ? 'Partners shown below — notify these four when a court opens.'
            : `Need ${WIN_LOSE_STACK_PLAYERS - dueCount} more in this stack before the next game can start.`,
      ])
    );
  } else if (!isNextUp && crossStackManual && selectable) {
    column.append(
      el('p', { className: 'win-lose-stack__due-hint' }, [
        'Tap players here too — manual mode can pull from either stack.',
      ])
    );
  }

  const previewIds = getLineupPreviewIds(
    selectedPlayerIds,
    selectable,
    lineupEligibleIds
  );
  if (
    isNextUp &&
    lineupEligibleIds.length >= WIN_LOSE_STACK_PLAYERS &&
    previewIds.length === WIN_LOSE_STACK_PLAYERS
  ) {
    column.append(renderNextLineupPreview(previewIds, players, lastPartnerByPlayer));
  }

  const list = el('ol', { className: 'win-lose-stack__list' });
  const showFullList = selectable;
  const waitingIds = showFullList
    ? playerIds
    : isNextUp && dueCount >= WIN_LOSE_STACK_PLAYERS
      ? playerIds.slice(WIN_LOSE_STACK_PLAYERS)
      : playerIds;
  const waitingOffset = showFullList
    ? 0
    : isNextUp && dueCount >= WIN_LOSE_STACK_PLAYERS
      ? WIN_LOSE_STACK_PLAYERS
      : 0;

  if (waitingIds.length === 0 && !showFullList && dueCount >= WIN_LOSE_STACK_PLAYERS && isNextUp) {
    list.append(
      el('li', { className: 'win-lose-stack__empty' }, ['No one else waiting in this stack'])
    );
  } else if (waitingIds.length === 0) {
    list.append(el('li', { className: 'win-lose-stack__empty' }, ['No players waiting']));
  } else {
    waitingIds.forEach((playerId, index) => {
      const name = playerName(players, playerId);
      const stackIndex = waitingOffset + index;
      const isSelected = selectable && selectedPlayerIds.includes(playerId);
      const isDue =
        isNextUp &&
        !selectable &&
        dueCount < WIN_LOSE_STACK_PLAYERS &&
        stackIndex < dueCount;

      const itemClasses = [
        'win-lose-stack__item',
        isDue ? 'win-lose-stack__item--due' : '',
        selectable ? 'win-lose-stack__item--selectable' : '',
        isSelected ? 'win-lose-stack__item--selected' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const itemChildren: HTMLElement[] = [
        el('span', { className: 'win-lose-stack__position' }, [String(stackIndex + 1)]),
        el('span', { className: 'win-lose-stack__name' }, [name]),
      ];

      if (allowReorder && interaction) {
        const actions = el('div', { className: 'win-lose-stack__item-actions' }, [
          renderReorderButton(
            'Move up',
            'up',
            playerId,
            stackIndex === 0,
            interaction.onReorder
          ),
          renderReorderButton(
            'Move down',
            'down',
            playerId,
            stackIndex === playerIds.length - 1,
            interaction.onReorder
          ),
        ]);
        itemChildren.push(actions);
      }

      const item = el('li', { className: itemClasses }, itemChildren);

      if (selectable && interaction) {
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute(
          'aria-pressed',
          isSelected ? 'true' : 'false'
        );
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

  if (!showFullList && waitingOffset > 0 && waitingIds.length > 0) {
    column.append(
      el('p', { className: 'win-lose-stack__waiting-label' }, ['Still waiting in this stack'])
    );
  }

  column.append(list);
  return column;
}

function ensureManualStackSelection(eligibleIds: string[], defaults: string[]): void {
  const ui = useQueueUiStore.getState();
  const valid = ui.stackSelectedPlayerIds.filter((id) => eligibleIds.includes(id));

  if (valid.length !== ui.stackSelectedPlayerIds.length) {
    if (valid.length === 0 && defaults.length >= WIN_LOSE_STACK_PLAYERS) {
      ui.syncStackDefaultSelection(defaults);
    } else {
      ui.setStackSelectedPlayerIds(valid);
    }
    return;
  }

  if (ui.stackSelectedPlayerIds.length === 0 && defaults.length >= WIN_LOSE_STACK_PLAYERS) {
    ui.syncStackDefaultSelection(defaults);
  }
}

/** Win/Lose Stack rotation panel — two stacks, Next-Up indicator, and cold-start control. */
export function renderWinLoseStackPanel(options: WinLoseStackPanelOptions): HTMLElement {
  const { queueState, players, openCourtCount, activeMatchCount, onNavigate } = options;
  const stack = ensureWinLoseStackState(queueState.winLoseStack);
  const manualMode = isRotationPaused(queueState);
  const autoRotationOn = !manualMode;
  const blockReason = getStackStartBlockReason(queueState, openCourtCount, activeMatchCount);
  const canStart = blockReason == null;

  const eligibleIds = getAllWaitingStackIds(stack);
  const defaultSelection = getDefaultStackSelection(stack, { crossStack: manualMode });

  if (manualMode) {
    ensureManualStackSelection(eligibleIds, defaultSelection);
  }

  const selectedPlayerIds = manualMode
    ? useQueueUiStore.getState().stackSelectedPlayerIds
    : [];
  const totalSelectedCount = selectedPlayerIds.filter((id) => eligibleIds.includes(id)).length;

  const makeInteraction = (allowReorder: boolean): StackColumnInteraction => ({
    manualMode: true,
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

  const winnersIsNext = stack.nextUp === 'winners';
  const losersIsNext = stack.nextUp === 'losers';

  const stacksGrid = el('div', { className: 'win-lose-stack__grid' });
  stacksGrid.append(
    renderStackColumn(
      'Winners',
      stack.winnerStack,
      players,
      winnersIsNext,
      stack.lastPartnerByPlayer,
      manualMode ? makeInteraction(winnersIsNext) : undefined,
      eligibleIds,
      totalSelectedCount,
      manualMode
    ),
    renderStackColumn(
      'Losers',
      stack.loserStack,
      players,
      losersIsNext,
      stack.lastPartnerByPlayer,
      manualMode ? makeInteraction(losersIsNext) : undefined,
      eligibleIds,
      totalSelectedCount,
      manualMode
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

    const started = useQueueStore
      .getState()
      .tryStartWinLoseStackMatch(openCourt.id, { manual: isRotationPaused(liveState) });
    if (!started) {
      alert(
        `Could not start a game. Need ${WIN_LOSE_STACK_PLAYERS} waiting players and an open court.`
      );
    }
    onNavigate();
  });

  const stickyDock = el('div', { className: 'win-lose-stack__sticky-dock', role: 'region', 'aria-label': 'Start next game' });
  if (blockReason) {
    stickyDock.append(
      el('p', {
        className: 'win-lose-stack__sticky-status win-lose-stack__sticky-status--blocked',
        role: 'status',
      }, [blockReason])
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
