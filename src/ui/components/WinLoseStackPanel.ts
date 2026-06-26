import { el } from '@/lib/dom-utils';
import { pickleballIconHtml } from '@/ui/icons/pickleball-icon';
import { useQueueStore } from '@/stores/queueStore';
import { useCourtStore } from '@/stores/courtStore';
import { Player } from '@/types/player';
import { isRotationPaused, QueueState } from '@/types/queue';
import { renderRotationControls } from '@/ui/components/RotationControlsPanel';
import { ensureWinLoseStackState } from '@/types/win-lose-stack';
import {
  countNextUpStackFromStack,
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

function renderStackColumn(
  title: string,
  playerIds: string[],
  players: Player[],
  isNextUp: boolean
): HTMLElement {
  const column = el('div', {
    className: `win-lose-stack__column${isNextUp ? ' win-lose-stack__column--next-up' : ''}`,
  });

  const header = el('div', { className: 'win-lose-stack__column-header' }, [
    el('h3', { className: 'win-lose-stack__column-title' }, [title]),
    isNextUp
      ? el('span', { className: 'win-lose-stack__next-badge' }, ['Next up'])
      : el('span', { className: 'win-lose-stack__count' }, [String(playerIds.length)]),
  ]);
  column.append(header);

  const list = el('ol', { className: 'win-lose-stack__list' });
  if (playerIds.length === 0) {
    list.append(el('li', { className: 'win-lose-stack__empty' }, ['No players waiting']));
  } else {
    playerIds.forEach((playerId, index) => {
      const name = players.find((player) => player.id === playerId)?.name ?? 'Unknown';
      list.append(
        el('li', { className: 'win-lose-stack__item' }, [
          el('span', { className: 'win-lose-stack__position' }, [String(index + 1)]),
          el('span', { className: 'win-lose-stack__name' }, [name]),
        ])
      );
    });
  }
  column.append(list);
  return column;
}

/** Win/Lose Stack rotation panel — two stacks, Next-Up indicator, and cold-start control. */
export function renderWinLoseStackPanel(options: WinLoseStackPanelOptions): HTMLElement {
  const { queueState, players, openCourtCount, activeMatchCount, onNavigate } = options;
  const stack = ensureWinLoseStackState(queueState.winLoseStack);
  const autoRotationOn = !isRotationPaused(queueState);
  const blockReason = getStackStartBlockReason(queueState, openCourtCount, activeMatchCount);
  const canStart = blockReason == null;

  const section = el('section', { className: 'queue-section queue-section--stacks' });
  section.append(
    el('div', { className: 'queue-section__header' }, [
      el('h2', { className: 'queue-section__title' }, ['Win/Lose Stacks']),
      el('span', { className: 'queue-section__count' }, [
        String(stack.winnerStack.length + stack.loserStack.length),
      ]),
    ])
  );

  section.append(renderRotationControls({ onNavigate, mode: 'stack' }));

  const statsRow = el('div', { className: 'stat-grid queue-section__stats queue-stat-grid' });
  statsRow.append(
    el('div', { className: 'stat-card queue-stat-card' }, [
      el('strong', {}, [String(stack.winnerStack.length)]),
      el('span', {}, ['Winners stack']),
    ]),
    el('div', { className: 'stat-card queue-stat-card' }, [
      el('strong', {}, [String(stack.loserStack.length)]),
      el('span', {}, ['Losers stack']),
    ]),
    el('div', { className: 'stat-card queue-stat-card' }, [
      el('strong', {}, [String(countNextUpStackFromStack(stack))]),
      el('span', {}, ['Next-up ready']),
    ]),
    el('div', { className: 'stat-card queue-stat-card' }, [
      el('strong', {}, [String(openCourtCount)]),
      el('span', {}, ['Open courts']),
    ])
  );
  section.append(statsRow);

  const stacksGrid = el('div', { className: 'win-lose-stack__grid' });
  stacksGrid.append(
    renderStackColumn('Winners', stack.winnerStack, players, stack.nextUp === 'winners'),
    renderStackColumn('Losers', stack.loserStack, players, stack.nextUp === 'losers')
  );
  section.append(stacksGrid);

  if (blockReason) {
    section.append(
      el('p', {
        className: 'screen-lead win-lose-stack__status win-lose-stack__status--blocked',
        role: 'status',
      }, [blockReason])
    );
  }

  const actions = el('div', { className: 'queue-section__actions' });
  const startBtn = el('button', {
    type: 'button',
    className: 'btn btn-success btn-create-match',
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

    const manual = isRotationPaused(liveState);
    const started = useQueueStore
      .getState()
      .tryStartWinLoseStackMatch(openCourt.id, { manual });
    if (!started) {
      alert(
        `Could not start a game. Need ${WIN_LOSE_STACK_PLAYERS} players in the Next-Up stack and an open court.`
      );
    }
    onNavigate();
  });

  actions.append(startBtn);

  if (activeMatchCount > 0 && autoRotationOn) {
    actions.append(
      el('p', { className: 'screen-lead win-lose-stack__hint' }, [
        'Recording a winner auto-starts the next game when the Next-Up stack has enough players.',
      ])
    );
  }

  section.append(actions);
  return section;
}
