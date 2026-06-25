import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { playerService } from '@/modules/players/PlayerService';
import { queueService } from '@/modules/queue/QueueService';
import { courtService } from '@/modules/courts/CourtService';
import { DEFAULT_COURT_COUNT, DEFAULT_ORGANIZER_NAME } from '@/config/constants';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import {
  canStartWinLoseStackMatch,
  reconcileStackWithCheckedInPlayers,
  removePlayerFromWinLoseStacks,
  resetWinLoseStackState,
  returnStackMatchToQueue,
  routePlayersAfterMatchComplete,
  seedCheckedInPlayersToWinnersStack,
  seedPlayerToWinnersStack,
  startNextStackMatch,
} from '@/modules/game-mode/winLoseStackMode';
import { GameMode, isWinLoseStackMode } from '@/types/game-mode';
import { isRotationPaused, Match, QueueState } from '@/types/queue';
import { Player, isPlayerMatchable } from '@/types/player';
import { buildLadderQueueStateForGameModeChange } from '@/stores/queueStoreLadderMode';

export function isStackModeActive(): boolean {
  const settings = useSessionStore.getState().loadSnapshot()?.settings;
  return isWinLoseStackMode(getGameMode(settings));
}

export function seedStackOnHydrate(queueState: QueueState, players: Player[]): QueueState {
  if (!isStackModeActive()) return queueState;
  if (isRotationPaused(queueState)) return queueState;
  let next = queueState.winLoseStack ? queueState : seedCheckedInPlayersToWinnersStack(queueState, []);
  next = reconcileStackWithCheckedInPlayers(next, players);
  return next;
}

export function ensureCourtsForStackMode(): void {
  const courts = useCourtStore.getState().courts;
  if (courts.length > 0) return;

  const ensured = courtService.ensureCourts([], DEFAULT_COURT_COUNT);
  const snapshot = useSessionStore.getState().loadSnapshot();
  useSessionStore.getState().persistSnapshot({
    courts: ensured,
    settings: {
      courtCount: ensured.length,
      organizerName:
        snapshot?.settings?.organizerName ??
        useSessionStore.getState().session?.organizerName ??
        DEFAULT_ORGANIZER_NAME,
    },
  });
  useCourtStore.getState().hydrate();
}

export function handleStackModeCancelMatch(
  queueState: QueueState,
  match: Match
): QueueState {
  return returnStackMatchToQueue(
    {
      ...queueState,
      activeMatches: queueState.activeMatches.filter((item) => item.id !== match.id),
    },
    match
  );
}

export function handleStackModeCompleteMatch(
  queueState: QueueState,
  match: Pick<Match, 'playerIds'>,
  winningTeam: 'A' | 'B'
): QueueState {
  return routePlayersAfterMatchComplete(queueState, match, winningTeam);
}

export function tryStartWinLoseStackMatchFromStore(
  queueState: QueueState,
  preferredCourtId?: string
): { state: QueueState; match: Match | null } {
  if (!isStackModeActive()) {
    return { state: queueState, match: null };
  }

  const courts = useCourtStore.getState().courts;
  const openCourt = preferredCourtId
    ? courts.find((court) => court.id === preferredCourtId && !court.activeMatchId)
    : courts.find((court) => !court.activeMatchId);
  if (!openCourt) return { state: queueState, match: null };
  if (!canStartWinLoseStackMatch(queueState)) return { state: queueState, match: null };

  const { state, match } = startNextStackMatch(queueState, openCourt.id);
  if (!match) return { state: queueState, match: null };

  useCourtStore.getState().assignMatch(openCourt.id, match.id);
  return { state, match };
}

export function seedPlayerForStackMode(
  queueState: QueueState,
  playerId: string
): QueueState {
  return seedPlayerToWinnersStack(queueState, playerId);
}

export function removePlayerForStackMode(
  queueState: QueueState,
  playerId: string
): QueueState {
  return removePlayerFromWinLoseStacks(queueState, playerId);
}

export function buildQueueStateForGameModeChange(
  current: QueueState,
  newMode: GameMode,
  players: Player[]
): QueueState {
  const checkedInIds = players.filter(isPlayerMatchable).map((player) => player.id);

  if (newMode === 'win_lose_stack') {
    ensureCourtsForStackMode();
    return seedCheckedInPlayersToWinnersStack(
      {
        queue: [],
        activeMatches: [],
        completedMatches: current.completedMatches,
        winLoseStack: resetWinLoseStackState(current).winLoseStack,
      },
      checkedInIds
    );
  }

  if (newMode === 'ladder_waterfall') {
    return buildLadderQueueStateForGameModeChange(current, players);
  }

  return {
    queue: [],
    activeMatches: [],
    completedMatches: current.completedMatches,
    winLoseStack: undefined,
    ladderWaterfall: undefined,
  };
}

export function syncStackPlayerAvailability(options: {
  unavailable?: string[];
  available?: string[];
}): void {
  const players = usePlayerStore.getState().players;
  const next = playerService.markPlayersAvailability(players, options);
  usePlayerStore.getState().replaceAll(next);
}

export function reconcileAvailableSinceForQueue(state: QueueState): void {
  const players = usePlayerStore.getState().players;
  const availableIds = new Set(
    queueService.getAvailablePlayers(players, state).map((player) => player.id)
  );
  const next = playerService.syncAvailableSince(players, availableIds);
  if (next.some((player, index) => player !== players[index])) {
    usePlayerStore.getState().replaceAll(next);
  }
}
