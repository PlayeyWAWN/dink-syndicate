import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { playerService } from '@/modules/players/PlayerService';
import { queueService } from '@/modules/queue/QueueService';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import {
  canStartWinLoseStackMatch,
  removePlayerFromWinLoseStacks,
  resetWinLoseStackState,
  returnStackMatchToQueue,
  routePlayersAfterMatchComplete,
  seedCheckedInPlayersToWinnersStack,
  seedPlayerToWinnersStack,
  startNextStackMatch,
} from '@/modules/game-mode/winLoseStackMode';
import { GameMode, isWinLoseStackMode } from '@/types/game-mode';
import { Match, QueueState } from '@/types/queue';
import { Player, isPlayerMatchable } from '@/types/player';

export function isStackModeActive(): boolean {
  const settings = useSessionStore.getState().loadSnapshot()?.settings;
  return isWinLoseStackMode(getGameMode(settings));
}

export function seedStackOnHydrate(queueState: QueueState, players: Player[]): QueueState {
  if (!isStackModeActive()) return queueState;
  if (queueState.winLoseStack) return queueState;
  const checkedInIds = players.filter(isPlayerMatchable).map((player) => player.id);
  return seedCheckedInPlayersToWinnersStack(queueState, checkedInIds);
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

  return {
    queue: [],
    activeMatches: [],
    completedMatches: current.completedMatches,
    winLoseStack: undefined,
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
