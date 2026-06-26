import { el } from '@/lib/dom-utils';
import { pickleballIconHtml } from '@/ui/icons/pickleball-icon';
import { useQueueStore } from '@/stores/queueStore';
import { useCourtStore } from '@/stores/courtStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { Court } from '@/types/court';
import { Player } from '@/types/player';
import { QueueState, isRotationPaused } from '@/types/queue';
import { ensureLadderWaterfallState } from '@/types/ladder-waterfall';
import { renderLadderCourtRungCard } from '@/ui/components/LadderCourtRungCard';
import { renderLadderRulesHero } from '@/ui/components/LadderRulesHero';
import { renderLadderWaterfallSidebar } from '@/ui/components/LadderWaterfallSidebar';
import {
  canStartLadderMatchOnCourt,
  countTotalLadderWaiting,
  getLadderStartBlockReason,
  LADDER_PLAYERS_PER_COURT,
} from '@/modules/game-mode/ladderWaterfallMode';

export interface LadderWaterfallPanelOptions {
  queueState: QueueState;
  courts: Court[];
  players: Player[];
  available: Player[];
  activeMatchCount: number;
  onNavigate: () => void;
  onComplete: (matchId: string, team: 'A' | 'B') => void;
  onCancel: (matchId: string) => void;
  onSwapPlayer: (matchId: string, playerIdA: string, playerIdB: string) => boolean;
  onReplacePlayer: (matchId: string, oldPlayerId: string, newPlayerId: string) => boolean;
}

/** Unified Ladder/Waterfall board — court cards, rules hero, and waterfall sidebar. */
export function renderLadderWaterfallPanel(options: LadderWaterfallPanelOptions): HTMLElement {
  const {
    queueState,
    courts,
    players,
    available,
    activeMatchCount,
    onNavigate,
    onComplete,
    onCancel,
    onSwapPlayer,
    onReplacePlayer,
  } = options;

  const ladder = ensureLadderWaterfallState(queueState.ladderWaterfall);
  const manualMode = isRotationPaused(queueState);
  const blockReason = getLadderStartBlockReason(queueState, courts, activeMatchCount);
  const canStartAny = blockReason == null;
  const selectedPoolPlayerId = useQueueUiStore.getState().ladderSelectedPoolPlayerId;

  const section = el('section', { className: 'queue-section queue-section--ladder' });
  section.append(
    el('div', { className: 'queue-section__header' }, [
      el('h2', { className: 'queue-section__title' }, ['Ladder / Waterfall']),
      el('span', { className: 'queue-section__count' }, [String(countTotalLadderWaiting(queueState))]),
    ])
  );

  section.append(renderLadderRulesHero({ onNavigate }));

  const board = el('div', { className: 'ladder-board' });
  const mainCol = el('div', { className: 'ladder-board__main' });

  const rungList = el('div', { className: 'ladder-board__rungs' });
  courts.forEach((court, rank) => {
    const benchIds = ladder.benchByCourtId[court.id] ?? [];
    const activeMatch =
      queueState.activeMatches.find((match) => match.courtId === court.id) ?? null;
    const isReady =
      !activeMatch && canStartLadderMatchOnCourt(queueState, court.id);

    rungList.append(
      renderLadderCourtRungCard({
        court,
        rank,
        totalCourts: courts.length,
        courts,
        benchIds,
        players,
        available,
        activeMatch,
        isReady,
        manualMode,
        selectedPoolPlayerId: manualMode ? selectedPoolPlayerId : null,
        onComplete,
        onCancel,
        onSwapPlayer,
        onReplacePlayer,
        onAssignPoolPlayer: (courtId) => {
          if (!selectedPoolPlayerId) return;
          const ok = useQueueStore
            .getState()
            .assignLadderPlayerToBench(selectedPoolPlayerId, courtId);
          if (!ok) {
            alert('Could not assign — pick a player from the waiting pool and an open bench slot.');
            return;
          }
          useQueueUiStore.getState().clearLadderSelection();
          onNavigate();
        },
        onReturnBenchPlayer: (playerId, courtId) => {
          const ok = useQueueStore.getState().returnLadderBenchPlayerToPool(playerId, courtId);
          if (!ok) {
            alert('Could not return player to the waiting pool.');
            return;
          }
          onNavigate();
        },
      })
    );
  });
  mainCol.append(rungList);

  if (blockReason) {
    mainCol.append(
      el('p', {
        className: 'screen-lead ladder-waterfall__status ladder-waterfall__status--blocked',
        role: 'status',
      }, [blockReason])
    );
  } else if (manualMode) {
    mainCol.append(
      el('p', {
        className: 'screen-lead ladder-waterfall__status ladder-waterfall__status--manual',
        role: 'status',
      }, [
        'Manual mode — after you record a winner, open bench slots stay empty until you assign players. Tap waiting-pool names, then an open bench slot, or turn on Auto-rotation.',
      ])
    );
  }

  const actions = el('div', { className: 'queue-section__actions ladder-board__actions' });
  const startBtn = el('button', {
    type: 'button',
    className: 'btn btn-success btn-create-match',
    disabled: canStartAny ? undefined : 'true',
  }) as HTMLButtonElement;
  startBtn.innerHTML = `${pickleballIconHtml()}<span>Start ready games</span>`;

  startBtn.addEventListener('click', () => {
    const liveCourts = useCourtStore.getState().courts;
    const liveState = useQueueStore.getState().queueState;
    const liveBlock = getLadderStartBlockReason(
      liveState,
      liveCourts,
      liveState.activeMatches.length
    );

    if (liveBlock) {
      alert(liveBlock);
      onNavigate();
      return;
    }

    const started = useQueueStore.getState().tryStartLadderMatch(undefined, { manual: true });
    if (!started) {
      alert(
        `Could not start a game. Need ${LADDER_PLAYERS_PER_COURT} players on a court bench and an open court.`
      );
    }
    onNavigate();
  });

  actions.append(startBtn);
  mainCol.append(actions);

  board.append(
    mainCol,
    renderLadderWaterfallSidebar({
      queueState,
      courts,
      players,
      manualMode,
      selectedPoolPlayerId: manualMode ? selectedPoolPlayerId : null,
      onSelectPoolPlayer: manualMode
        ? (playerId) => {
            const ui = useQueueUiStore.getState();
            ui.setLadderSelectedPoolPlayer(
              ui.ladderSelectedPoolPlayerId === playerId ? null : playerId
            );
            onNavigate();
          }
        : undefined,
    })
  );
  section.append(board);

  return section;
}
