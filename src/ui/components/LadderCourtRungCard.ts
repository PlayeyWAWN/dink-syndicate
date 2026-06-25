import { el } from '@/lib/dom-utils';
import { formatMatchDuration } from '@/lib/match-timer';
import { formatTeamLabel } from '@/lib/format-utils';
import { announceActiveMatch, isTtsSupported } from '@/lib/tts-service';
import {
  LADDER_PLAYERS_PER_COURT,
  LadderMovementDirection,
  previewLadderMovement,
} from '@/modules/game-mode/ladderWaterfallMode';
import { useSessionStore } from '@/stores/sessionStore';
import { Court } from '@/types/court';
import { Player } from '@/types/player';
import { Match } from '@/types/queue';
import { renderMatchCourtBoard } from '@/ui/components/MatchCourtBoard';
import { renderMatchPlayerChip } from '@/ui/components/MatchPlayerChip';
import { openQueuePlayerEditDialog } from '@/ui/components/QueuePlayerEditDialog';
import { createAppIcon, mountAppIcon } from '@/ui/icons/app-icons';

export interface LadderCourtRungCardOptions {
  court: Court;
  rank: number;
  totalCourts: number;
  courts: Court[];
  benchIds: string[];
  players: Player[];
  available: Player[];
  activeMatch: Match | null;
  isReady: boolean;
  manualMode: boolean;
  selectedPoolPlayerId: string | null;
  onComplete: (matchId: string, team: 'A' | 'B') => void;
  onCancel: (matchId: string) => void;
  onSwapPlayer: (matchId: string, playerIdA: string, playerIdB: string) => boolean;
  onReplacePlayer: (matchId: string, oldPlayerId: string, newPlayerId: string) => boolean;
  onAssignPoolPlayer: (courtId: string) => void;
  onReturnBenchPlayer: (playerId: string, courtId: string) => void;
}

function rankModifierClass(rank: number): string {
  if (rank === 0) return 'ladder-rung--gold';
  if (rank === 1) return 'ladder-rung--silver';
  if (rank === 2) return 'ladder-rung--bronze';
  return 'ladder-rung--standard';
}

function formatCourtHeading(court: Court): string {
  const label = court.label.trim();
  return /^\d+$/.test(label) ? `Court ${label}` : label;
}

function formatTargetCourtLabel(label: string): string {
  const trimmed = label.trim();
  return /^\d+$/.test(trimmed) ? `Court ${trimmed}` : trimmed;
}

function directionLabel(direction: LadderMovementDirection): string {
  if (direction === 'up') return 'move up';
  if (direction === 'down') return 'move down';
  return 'stay';
}

function winButtonLabel(team: 'A' | 'B', match: Match, courts: Court[]): string {
  const preview = previewLadderMovement(match, team, courts);
  const teamNum = team === 'A' ? '1' : '2';
  if (!preview) return `Team ${teamNum} Wins`;

  const direction = team === 'A' ? preview.winnerDirection : preview.loserDirection;
  const target = team === 'A' ? preview.winnerTargetCourtLabel : preview.loserTargetCourtLabel;
  return `Team ${teamNum} Wins → ${directionLabel(direction)} (${formatTargetCourtLabel(target)})`;
}

function renderBenchSlots(
  benchIds: string[],
  players: Player[],
  options: {
    courtId: string;
    manualMode: boolean;
    selectedPoolPlayerId: string | null;
    onAssignPoolPlayer: (courtId: string) => void;
    onReturnBenchPlayer: (playerId: string, courtId: string) => void;
  }
): HTMLElement {
  const {
    courtId,
    manualMode,
    selectedPoolPlayerId,
    onAssignPoolPlayer,
    onReturnBenchPlayer,
  } = options;
  const canAssign = Boolean(selectedPoolPlayerId);
  const wrap = el('div', { className: 'ladder-rung__bench-slots' });
  for (let index = 0; index < LADDER_PLAYERS_PER_COURT; index += 1) {
    const playerId = benchIds[index];
    const player = playerId ? players.find((item) => item.id === playerId) : undefined;
    const isEmpty = !player;
    const slot = el('div', {
      className: [
        'ladder-rung__bench-slot',
        player ? 'ladder-rung__bench-slot--filled' : '',
        isEmpty && canAssign ? 'ladder-rung__bench-slot--assignable' : '',
        player && manualMode ? 'ladder-rung__bench-slot--returnable' : '',
      ]
        .filter(Boolean)
        .join(' '),
      ...(isEmpty && canAssign
        ? {
            role: 'button',
            tabIndex: '0',
            title: 'Assign selected waiting-pool player here',
          }
        : player && manualMode
          ? {
              role: 'button',
              tabIndex: '0',
              title: 'Return player to waiting pool',
            }
          : {}),
    });

    if (isEmpty && canAssign) {
      slot.append(el('span', { className: 'ladder-rung__bench-slot-hint' }, ['Tap to assign']));
      slot.addEventListener('click', () => onAssignPoolPlayer(courtId));
      slot.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAssignPoolPlayer(courtId);
        }
      });
    } else if (player) {
      slot.append(renderMatchPlayerChip(player, { metaFormat: 'dupr' }));
      if (manualMode) {
        slot.addEventListener('click', () => onReturnBenchPlayer(playerId!, courtId));
        slot.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onReturnBenchPlayer(playerId!, courtId);
          }
        });
      }
    }

    wrap.append(slot);
  }
  return wrap;
}

function renderMovementPreview(
  match: Match,
  courts: Court[],
  players: Player[]
): HTMLElement {
  const previewA = previewLadderMovement(match, 'A', courts);
  const previewB = previewLadderMovement(match, 'B', courts);
  const wrap = el('div', { className: 'ladder-rung__movement-preview' });

  if (previewA) {
    wrap.append(
      el('div', { className: 'ladder-rung__movement-row ladder-rung__movement-row--win' }, [
        el('span', { className: 'ladder-rung__movement-label' }, ['If Team 1 wins:']),
        el('span', { className: 'ladder-rung__movement-detail' }, [
          `${formatTeamLabel(match.playerIds, players, 'A')} ↑ ${formatTargetCourtLabel(previewA.winnerTargetCourtLabel)}`,
        ]),
        el('span', { className: 'ladder-rung__movement-detail' }, [
          `${formatTeamLabel(match.playerIds, players, 'B')} ↓ ${formatTargetCourtLabel(previewA.loserTargetCourtLabel)}`,
        ]),
      ])
    );
  }

  if (previewB) {
    wrap.append(
      el('div', { className: 'ladder-rung__movement-row ladder-rung__movement-row--alt' }, [
        el('span', { className: 'ladder-rung__movement-label' }, ['If Team 2 wins:']),
        el('span', { className: 'ladder-rung__movement-detail' }, [
          `${formatTeamLabel(match.playerIds, players, 'B')} ↑ ${formatTargetCourtLabel(previewB.winnerTargetCourtLabel)}`,
        ]),
        el('span', { className: 'ladder-rung__movement-detail' }, [
          `${formatTeamLabel(match.playerIds, players, 'A')} ↓ ${formatTargetCourtLabel(previewB.loserTargetCourtLabel)}`,
        ]),
      ])
    );
  }

  return wrap;
}

/** One court rung on the ladder board — active match, ready bench, or waiting bench. */
export function renderLadderCourtRungCard(options: LadderCourtRungCardOptions): HTMLElement {
  const {
    court,
    rank,
    totalCourts,
    courts,
    benchIds,
    players,
    available,
    activeMatch,
    isReady,
    manualMode,
    selectedPoolPlayerId,
    onComplete,
    onCancel,
    onSwapPlayer,
    onReplacePlayer,
    onAssignPoolPlayer,
    onReturnBenchPlayer,
  } = options;

  const isTop = rank === 0;
  const isBottom = rank === totalCourts - 1;
  const stateClass = activeMatch
    ? 'ladder-rung--active'
    : isReady
      ? 'ladder-rung--ready'
      : 'ladder-rung--waiting';

  const card = el('article', {
    className: `ladder-rung ${rankModifierClass(rank)} ${stateClass}`,
  });

  const header = el('div', { className: 'ladder-rung__header' });
  const titleWrap = el('div', { className: 'ladder-rung__title-wrap' });
  titleWrap.append(el('h3', { className: 'ladder-rung__title' }, [formatCourtHeading(court)]));

  if (isTop) {
    titleWrap.append(
      el('span', { className: 'ladder-rung__badge ladder-rung__badge--top' }, ["Winner's court"])
    );
  } else if (isBottom) {
    titleWrap.append(
      el('span', { className: 'ladder-rung__badge ladder-rung__badge--bottom' }, ['Bottom rung'])
    );
  }

  const status = el('div', { className: 'ladder-rung__status-wrap' });
  if (activeMatch) {
    const startedAt = activeMatch.startedAt ?? Date.now();
    status.append(
      el('span', { className: 'ladder-rung__status ladder-rung__status--live' }, ['In progress']),
      el('span', {
        className: 'match-timer ladder-rung__timer',
        'data-started-at': String(startedAt),
      }, [formatMatchDuration(Date.now() - startedAt)])
    );
  } else if (isReady) {
    status.append(
      el('span', {
        className: manualMode
          ? 'ladder-rung__status ladder-rung__status--manual'
          : 'ladder-rung__status ladder-rung__status--ready',
      }, [manualMode ? 'Ready (manual)' : 'Ready to start'])
    );
  } else {
    status.append(
      el('span', { className: 'ladder-rung__status' }, [
        `${benchIds.length}/${LADDER_PLAYERS_PER_COURT} on bench`,
      ])
    );
  }

  header.append(titleWrap, status);

  if (activeMatch) {
    const actions = el('div', { className: 'ladder-rung__header-actions' });
    const announceBtn = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm ladder-rung__announce-btn',
        title: 'Announce match and player names (text to speech)',
      },
      []
    );
    announceBtn.append(createAppIcon('announce'), document.createTextNode(' Announce'));
    announceBtn.addEventListener('click', () => {
      if (!isTtsSupported()) {
        alert('Text to speech is not available in this browser.');
        return;
      }
      try {
        const voiceUri = useSessionStore.getState().loadSnapshot()?.settings?.ttsVoiceUri;
        announceActiveMatch(activeMatch, court.label, players, voiceUri);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Could not start speech.');
      }
    });

    const cancelBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm ladder-rung__cancel-btn',
      title: 'Cancel match and return players to this court bench',
      'aria-label': 'Cancel match',
    });
    mountAppIcon(cancelBtn, 'delete');
    cancelBtn.addEventListener('click', () => {
      const confirmed = window.confirm(
        'Cancel this match?\n\n' +
          '• Players return to this court bench\n' +
          '• No winner is recorded'
      );
      if (!confirmed) return;
      onCancel(activeMatch.id);
    });

    actions.append(announceBtn, cancelBtn);
    header.append(actions);
  }

  card.append(header);

  const body = el('div', { className: 'ladder-rung__body' });

  if (activeMatch) {
    body.append(
      renderMatchCourtBoard({
        playerIds: activeMatch.playerIds,
        players,
        active: true,
        label: formatCourtHeading(court),
        metaFormat: 'dupr',
        onPlayerChipClick: (playerId) => {
          const player = players.find((item) => item.id === playerId);
          if (!player) return;

          openQueuePlayerEditDialog({
            lineup: activeMatch,
            player,
            players,
            available,
            onSwap: (otherPlayerId) => {
              if (!onSwapPlayer(activeMatch.id, playerId, otherPlayerId)) {
                alert('Could not swap — gender rules for this match mode may block that lineup.');
              }
            },
            onReplace: (newPlayerId) => {
              if (!onReplacePlayer(activeMatch.id, playerId, newPlayerId)) {
                alert('Could not replace — check gender rules and player availability.');
              }
            },
          });
        },
      })
    );

    body.append(renderMovementPreview(activeMatch, courts, players));

    const winRow = el('div', { className: 'ladder-rung__win-row' });
    const win1 = el('button', {
      type: 'button',
      className: 'btn btn-sm ladder-rung__win-btn ladder-rung__win-btn--team1',
    }, [winButtonLabel('A', activeMatch, courts)]);
    const win2 = el('button', {
      type: 'button',
      className: 'btn btn-sm ladder-rung__win-btn ladder-rung__win-btn--team2',
    }, [winButtonLabel('B', activeMatch, courts)]);
    win1.addEventListener('click', () => onComplete(activeMatch.id, 'A'));
    win2.addEventListener('click', () => onComplete(activeMatch.id, 'B'));
    winRow.append(win1, win2);
    body.append(winRow);
  } else {
    body.append(
      renderBenchSlots(benchIds, players, {
        courtId: court.id,
        manualMode,
        selectedPoolPlayerId,
        onAssignPoolPlayer,
        onReturnBenchPlayer,
      })
    );
  }

  card.append(body);
  return card;
}
