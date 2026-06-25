import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { playerService } from '@/modules/players/PlayerService';
import { courtService } from '@/modules/courts/CourtService';
import { DEFAULT_ORGANIZER_NAME } from '@/config/constants';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import {
  assignPlayerFromPoolToBench,
  fillLadderBenchesFromWaitingPool,
  maybeFillLadderBenchesFromWaitingPool,
  reconcileLadderWithCheckedInPlayers,
  removePlayerFromLadder,
  resetLadderWaterfallState,
  returnBenchPlayerToPool,
  returnLadderMatchToBench,
  routePlayersAfterLadderMatch,
  seedCheckedInPlayersToLadder,
  seedPlayerToLadder,
  tryStartReadyLadderMatches,
} from '@/modules/game-mode/ladderWaterfallMode';
import { GameMode, isLadderWaterfallMode } from '@/types/game-mode';
import { isRotationPaused, Match, QueueState } from '@/types/queue';
import { Player, isPlayerMatchable } from '@/types/player';

export const MIN_LADDER_COURT_COUNT = 2;

export function isLadderModeActive(): boolean {
  const settings = useSessionStore.getState().loadSnapshot()?.settings;
  return isLadderWaterfallMode(getGameMode(settings));
}

export function seedLadderOnHydrate(
  queueState: QueueState,
  players: Player[],
  courts: ReturnType<typeof useCourtStore.getState>['courts']
): QueueState {
  if (!isLadderModeActive()) return queueState;
  if (isRotationPaused(queueState)) return queueState;
  let next = queueState.ladderWaterfall
    ? queueState
    : seedCheckedInPlayersToLadder(queueState, [], courts, players);
  next = reconcileLadderWithCheckedInPlayers(next, players, courts);
  return next;
}

export function ensureCourtsForLadderMode(): void {
  const courts = useCourtStore.getState().courts;
  if (courts.length >= MIN_LADDER_COURT_COUNT) return;

  const ensured = courtService.ensureCourts(courts, MIN_LADDER_COURT_COUNT);
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

export function handleLadderModeCancelMatch(
  queueState: QueueState,
  match: Match
): QueueState {
  return returnLadderMatchToBench(
    {
      ...queueState,
      activeMatches: queueState.activeMatches.filter((item) => item.id !== match.id),
    },
    match
  );
}

export function handleLadderModeCompleteMatch(
  queueState: QueueState,
  match: Pick<Match, 'playerIds' | 'ladderMeta'>,
  winningTeam: 'A' | 'B',
  courts: ReturnType<typeof useCourtStore.getState>['courts'],
  players: Player[]
): QueueState {
  const routed = routePlayersAfterLadderMatch(queueState, match, winningTeam, courts);
  return maybeFillLadderBenchesFromWaitingPool(routed, courts, players);
}

export function tryStartLadderMatchFromStore(
  queueState: QueueState,
  preferredCourtId?: string
): { state: QueueState; matches: Match[] } {
  if (!isLadderModeActive()) {
    return { state: queueState, matches: [] };
  }

  const courts = useCourtStore.getState().courts;
  const players = usePlayerStore.getState().players;
  const { state, matches } = tryStartReadyLadderMatches(
    queueState,
    courts,
    preferredCourtId
  );

  const filled = maybeFillLadderBenchesFromWaitingPool(state, courts, players);

  for (const match of matches) {
    if (match.courtId) {
      useCourtStore.getState().assignMatch(match.courtId, match.id);
    }
  }

  return { state: filled, matches };
}

export function seedPlayerForLadderMode(
  queueState: QueueState,
  playerId: string,
  players: Player[]
): QueueState {
  const courts = useCourtStore.getState().courts;
  return seedPlayerToLadder(queueState, playerId, courts, players);
}

export function removePlayerForLadderMode(
  queueState: QueueState,
  playerId: string
): QueueState {
  return removePlayerFromLadder(queueState, playerId);
}

export function assignLadderPoolPlayerToBenchFromStore(
  queueState: QueueState,
  playerId: string,
  courtId: string
): QueueState | null {
  if (!isLadderModeActive()) return null;
  const courts = useCourtStore.getState().courts;
  return assignPlayerFromPoolToBench(queueState, playerId, courtId, courts);
}

export function returnLadderBenchPlayerToPoolFromStore(
  queueState: QueueState,
  playerId: string,
  courtId: string,
  players: Player[]
): QueueState | null {
  if (!isLadderModeActive()) return null;
  return returnBenchPlayerToPool(queueState, playerId, courtId, players);
}

export function buildLadderQueueStateForGameModeChange(
  current: QueueState,
  players: Player[]
): QueueState {
  ensureCourtsForLadderMode();
  const courts = useCourtStore.getState().courts;
  const checkedInIds = players.filter(isPlayerMatchable).map((player) => player.id);

  return seedCheckedInPlayersToLadder(
    {
      queue: [],
      activeMatches: [],
      completedMatches: current.completedMatches,
      ladderWaterfall: resetLadderWaterfallState(current).ladderWaterfall,
    },
    checkedInIds,
    courts,
    players
  );
}

/** Fresh DUPR ladder seed for a new session (cleared stats, manual mode by default). */
export function buildLadderQueueStateForNewSession(players: Player[]): QueueState {
  ensureCourtsForLadderMode();
  const courts = useCourtStore.getState().courts;
  const checkedInIds = players.filter(isPlayerMatchable).map((player) => player.id);
  const base: QueueState = {
    queue: [],
    activeMatches: [],
    completedMatches: [],
    rotationPaused: true,
  };
  const seeded = seedCheckedInPlayersToLadder(base, checkedInIds, courts, players);
  return fillLadderBenchesFromWaitingPool(seeded, courts, players);
}

export function syncLadderPlayerAvailability(options: {
  unavailable?: string[];
  available?: string[];
}): void {
  const players = usePlayerStore.getState().players;
  const next = playerService.markPlayersAvailability(players, options);
  usePlayerStore.getState().replaceAll(next);
}

export function getLadderUnavailablePlayerIds(state: QueueState): string[] {
  const ladder = state.ladderWaterfall;
  if (!ladder) return [];
  const onBenches = Object.values(ladder.benchByCourtId).flat();
  return [...onBenches, ...ladder.waitingPool];
}

export function isRotationGameMode(mode: GameMode): boolean {
  return mode === 'win_lose_stack' || mode === 'ladder_waterfall';
}
