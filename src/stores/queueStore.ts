import { create } from 'zustand';

import { matchService } from '@/modules/match/MatchService';
import { matchmakingService } from '@/modules/matchmaking/MatchmakingService';
import { createId } from '@/modules/matchmaking/create-id';
import { queueService } from '@/modules/queue/QueueService';
import {
  applyCompletedMatchCorrection,
  CompletedMatchUpdate,
} from '@/modules/queue/CompletedMatchService';
import {
  buildManualMatch,
  validateEntryGenderRules,
} from '@/modules/queue/ManualMatchService';
import { playerService } from '@/modules/players/PlayerService';
import { winnerIdsForTeam } from '@/lib/format-utils';
import { usePlayerStore } from '@/stores/playerStore';
import { useSessionStore } from '@/stores/sessionStore';
import { toSessionSettings } from '@/types/app-data';
import { useCourtStore } from '@/stores/courtStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { CourtFormat, QueueMatchMode } from '@/config/queue-match-modes';
import { QueueState, QueueEntry, isRotationPaused } from '@/types/queue';
import { Player, isPlayerMatchable } from '@/types/player';
import { GameMode } from '@/types/game-mode';
import {
  buildQueueStateForGameModeChange,
  ensureCourtsForStackMode,
  handleStackModeCancelMatch,
  handleStackModeCompleteMatch,
  isStackModeActive,
  reconcileAvailableSinceForQueue,
  removePlayerForStackMode,
  seedPlayerForStackMode,
  seedStackOnHydrate,
  syncStackPlayerAvailability,
  tryStartWinLoseStackMatchFromStore,
} from '@/stores/queueStoreStackMode';
import {
  ensureCourtsForLadderMode,
  getLadderUnavailablePlayerIds,
  handleLadderModeCancelMatch,
  handleLadderModeCompleteMatch,
  isLadderModeActive,
  removePlayerForLadderMode,
  seedLadderOnHydrate,
  seedPlayerForLadderMode,
  syncLadderPlayerAvailability,
  tryStartLadderMatchFromStore,
} from '@/stores/queueStoreLadderMode';
import { reconcileStackWithCheckedInPlayers } from '@/modules/game-mode/winLoseStackMode';
import { reconcileLadderWithCheckedInPlayers } from '@/modules/game-mode/ladderWaterfallMode';
const emptyQueueState = (): QueueState => ({
  queue: [],
  activeMatches: [],
  completedMatches: [],
});

interface QueueStoreState {
  queueState: QueueState;
  hydrate: () => void;
  getAvailablePlayers: () => Player[];
  getStandbyExcludedPlayers: () => Player[];
  createMatch: (courtFormat: CourtFormat, matchMode: QueueMatchMode) => boolean;
  createManualMatch: (
    courtFormat: CourtFormat,
    matchMode: QueueMatchMode,
    selectedIds: string[]
  ) => { ok: true } | { ok: false; message: string };
  swapQueuePlayers: (entryId: string, playerIdA: string, playerIdB: string) => boolean;
  replaceQueuePlayer: (entryId: string, oldPlayerId: string, newPlayerId: string) => boolean;
  cancelActiveMatch: (matchId: string) => boolean;
  swapActiveMatchPlayers: (matchId: string, playerIdA: string, playerIdB: string) => boolean;
  replaceActiveMatchPlayer: (matchId: string, oldPlayerId: string, newPlayerId: string) => boolean;
  removeFromQueue: (entryId: string) => void;
  startMatchOnCourt: (entryId: string, courtId: string) => boolean;
  playQueueEntry: (entryId: string) => boolean;
  completeMatch: (matchId: string, winningTeam: 'A' | 'B') => boolean;
  updateCompletedMatch: (
    matchId: string,
    update: CompletedMatchUpdate
  ) => { ok: true } | { ok: false; message: string };
  clearSessionQueue: () => void;
  tryStartWinLoseStackMatch: (preferredCourtId?: string) => boolean;
  onPlayerCheckedInForStackMode: (playerId: string) => void;
  onPlayerRemovedFromStackMode: (playerId: string) => void;
  tryStartLadderMatch: (preferredCourtId?: string) => boolean;
  onPlayerCheckedInForLadderMode: (playerId: string) => void;
  onPlayerRemovedFromLadderMode: (playerId: string) => void;
  resetForGameModeChange: (newMode: GameMode) => void;
  reconcileWinLoseStackState: () => void;
  reconcileLadderState: () => void;
  stopRotation: () => void;
  resumeRotation: () => void;
}
function persist(state: QueueState): void {
  useSessionStore.getState().persistSnapshot({ queueState: state });
}

function syncPlayerAvailability(options: { available?: string[]; unavailable?: string[] }): void {
  const players = usePlayerStore.getState().players;
  const next = playerService.markPlayersAvailability(players, options);
  usePlayerStore.getState().replaceAll(next);
}

function attachAvailableSinceSnapshot(entry: QueueEntry, players: Player[]): QueueEntry {
  const now = Date.now();
  const availableSinceByPlayer: Record<string, number> = {};
  for (const id of entry.playerIds) {
    const player = players.find((p) => p.id === id);
    availableSinceByPlayer[id] = player?.availableSince ?? now;
  }
  return { ...entry, availableSinceByPlayer };
}

function restorePlayersFromQueue(entry: QueueEntry): void {
  const players = usePlayerStore.getState().players;
  const next = playerService.restoreAvailableFromQueue(players, entry);
  usePlayerStore.getState().replaceAll(next);
}

function getPlayersWithExpiredPausesCleared(): Player[] {
  const players = usePlayerStore.getState().players;
  const next = playerService.clearExpiredPauses(players);
  if (next !== players) {
    usePlayerStore.getState().replaceAll(next);
  }
  return next;
}

function reconcileAvailableSince(state: QueueState): void {
  reconcileAvailableSinceForQueue(state);
}

export const useQueueStore = create<QueueStoreState>((set, get) => {
  const commitQueueEntry = (entry: QueueEntry): void => {
    const players = usePlayerStore.getState().players;
    const queuedEntry = attachAvailableSinceSnapshot(entry, players);
    const next = queueService.enqueue(get().queueState, queuedEntry);
    set({ queueState: next });
    persist(next);
    syncPlayerAvailability({ unavailable: queuedEntry.playerIds });
  };

  return {
    queueState: emptyQueueState(),

    hydrate: () => {
      const snapshot = useSessionStore.getState().loadSnapshot();
      const players = snapshot?.players ?? [];
      const courts = snapshot?.courts ?? [];
      let queueState = snapshot?.queueState ?? emptyQueueState();
      queueState = seedStackOnHydrate(queueState, players);
      queueState = seedLadderOnHydrate(queueState, players, courts);
      set({ queueState });
      reconcileAvailableSince(queueState);
    },

    getAvailablePlayers: () => {
      const players = getPlayersWithExpiredPausesCleared();
      return queueService.getAvailablePlayers(players, get().queueState);
    },

    getStandbyExcludedPlayers: () => {
      const players = getPlayersWithExpiredPausesCleared();
      const excluded = queueService.getStandbyExcludedPlayers(players, get().queueState);
      return queueService.sortStandbyExcludedPlayers(excluded);
    },

    createMatch: (courtFormat, matchMode) => {
      const players = usePlayerStore.getState().players;
      const snapshot = useSessionStore.getState().loadSnapshot();

      const entry = matchmakingService.buildMatch({
        courtFormat,
        matchMode,
        players,
        queueState: get().queueState,
        sessionSettings: toSessionSettings(snapshot?.settings),
      });

      if (!entry) return false;
      commitQueueEntry(entry);
      return true;
    },

    createManualMatch: (courtFormat, matchMode, selectedIds) => {
      const available = get().getAvailablePlayers();
      const availableSet = new Set(available.map((player) => player.id));
      if (!selectedIds.every((id) => availableSet.has(id))) {
        return { ok: false, message: 'All selected players must be available.' };
      }

      const selected = selectedIds
        .map((id) => available.find((player) => player.id === id))
        .filter(Boolean) as Player[];
      const built = buildManualMatch(courtFormat, matchMode, selected);
      if (!built.ok) return built;

      const players = usePlayerStore.getState().players;
      if (!validateEntryGenderRules(built.format, built.playerIds, players)) {
        return { ok: false, message: 'Lineup does not satisfy gender rules for this match mode.' };
      }

      const entry: QueueEntry = {
        id: createId('queue'),
        playerIds: built.playerIds,
        format: built.format,
        createdAt: Date.now(),
        source: 'manual',
      };
      commitQueueEntry(entry);
      return { ok: true };
    },

    swapQueuePlayers: (entryId, playerIdA, playerIdB) => {
      const entry = get().queueState.queue.find((item) => item.id === entryId);
      if (!entry || playerIdA === playerIdB) return false;

      const idxA = entry.playerIds.indexOf(playerIdA);
      const idxB = entry.playerIds.indexOf(playerIdB);
      if (idxA === -1 || idxB === -1) return false;

      const nextIds = [...entry.playerIds];
      nextIds[idxA] = playerIdB;
      nextIds[idxB] = playerIdA;

      const players = usePlayerStore.getState().players;
      if (!validateEntryGenderRules(entry.format, nextIds, players)) return false;

      const nextQueue = get().queueState.queue.map((item) =>
        item.id === entryId ? { ...item, playerIds: nextIds } : item
      );
      const nextState = { ...get().queueState, queue: nextQueue };
      set({ queueState: nextState });
      persist(nextState);
      return true;
    },

    replaceQueuePlayer: (entryId, oldPlayerId, newPlayerId) => {
      if (oldPlayerId === newPlayerId) return false;

      const entry = get().queueState.queue.find((item) => item.id === entryId);
      if (!entry || !entry.playerIds.includes(oldPlayerId)) return false;
      if (entry.playerIds.includes(newPlayerId)) return false;

      const available = get().getAvailablePlayers();
      if (!available.some((player) => player.id === newPlayerId)) return false;

      const nextIds = entry.playerIds.map((id) => (id === oldPlayerId ? newPlayerId : id));
      const players = usePlayerStore.getState().players;
      if (!validateEntryGenderRules(entry.format, nextIds, players)) return false;

      const newPlayer = players.find((player) => player.id === newPlayerId);
      const now = Date.now();
      const restoredSince = entry.availableSinceByPlayer?.[oldPlayerId] ?? newPlayer?.availableSince ?? now;
      const availableSinceByPlayer = { ...(entry.availableSinceByPlayer ?? {}) };
      delete availableSinceByPlayer[oldPlayerId];
      availableSinceByPlayer[newPlayerId] = newPlayer?.availableSince ?? now;

      const nextQueue = get().queueState.queue.map((item) =>
        item.id === entryId ? { ...item, playerIds: nextIds, availableSinceByPlayer } : item
      );
      const nextState = { ...get().queueState, queue: nextQueue };
      set({ queueState: nextState });
      persist(nextState);

      const updatedPlayers = players.map((item) => {
        if (item.id === oldPlayerId) {
          return { ...item, availableSince: restoredSince, updatedAt: now };
        }
        if (item.id === newPlayerId) {
          return { ...item, availableSince: undefined, updatedAt: now };
        }
        return item;
      });
      usePlayerStore.getState().replaceAll(updatedPlayers);
      return true;
    },

    removeFromQueue: (entryId) => {
      const entry = get().queueState.queue.find((e) => e.id === entryId);
      const next = queueService.dequeue(get().queueState, entryId);
      set({ queueState: next });
      persist(next);
      if (entry) {
        restorePlayersFromQueue(entry);
      }
    },

    cancelActiveMatch: (matchId) => {
      const match = get().queueState.activeMatches.find((item) => item.id === matchId);
      if (!match) return false;

      if (isStackModeActive() && match.stackMeta) {
        const nextState = handleStackModeCancelMatch(get().queueState, match);
        set({ queueState: nextState });
        if (match.courtId) {
          useCourtStore.getState().clearCourt(match.courtId);
        }
        persist(nextState);
        syncPlayerAvailability({ unavailable: match.playerIds });
        return true;
      }

      if (isLadderModeActive() && match.ladderMeta) {
        const nextState = handleLadderModeCancelMatch(get().queueState, match);
        set({ queueState: nextState });
        if (match.courtId) {
          useCourtStore.getState().clearCourt(match.courtId);
        }
        persist(nextState);
        syncLadderPlayerAvailability({ unavailable: getLadderUnavailablePlayerIds(nextState) });
        return true;
      }

      const nextState = queueService.returnActiveMatchToQueue(get().queueState, matchId);
      if (!nextState) return false;

      set({ queueState: nextState });
      if (match.courtId) {
        useCourtStore.getState().clearCourt(match.courtId);
      }
      persist(nextState);
      return true;
    },

    swapActiveMatchPlayers: (matchId, playerIdA, playerIdB) => {
      const match = get().queueState.activeMatches.find((item) => item.id === matchId);
      if (!match || playerIdA === playerIdB) return false;

      const idxA = match.playerIds.indexOf(playerIdA);
      const idxB = match.playerIds.indexOf(playerIdB);
      if (idxA === -1 || idxB === -1) return false;

      const nextIds = [...match.playerIds];
      nextIds[idxA] = playerIdB;
      nextIds[idxB] = playerIdA;

      const players = usePlayerStore.getState().players;
      if (!validateEntryGenderRules(match.format, nextIds, players)) return false;

      const nextMatches = get().queueState.activeMatches.map((item) =>
        item.id === matchId ? { ...item, playerIds: nextIds } : item
      );
      const nextState = { ...get().queueState, activeMatches: nextMatches };
      set({ queueState: nextState });
      persist(nextState);
      return true;
    },

    replaceActiveMatchPlayer: (matchId, oldPlayerId, newPlayerId) => {
      if (oldPlayerId === newPlayerId) return false;

      const match = get().queueState.activeMatches.find((item) => item.id === matchId);
      if (!match || !match.playerIds.includes(oldPlayerId)) return false;
      if (match.playerIds.includes(newPlayerId)) return false;

      const available = get().getAvailablePlayers();
      if (!available.some((player) => player.id === newPlayerId)) return false;

      const nextIds = match.playerIds.map((id) => (id === oldPlayerId ? newPlayerId : id));
      const players = usePlayerStore.getState().players;
      if (!validateEntryGenderRules(match.format, nextIds, players)) return false;

      const newPlayer = players.find((player) => player.id === newPlayerId);
      const now = Date.now();
      const restoredSince =
        match.availableSinceByPlayer?.[oldPlayerId] ?? newPlayer?.availableSince ?? now;
      const availableSinceByPlayer = { ...(match.availableSinceByPlayer ?? {}) };
      delete availableSinceByPlayer[oldPlayerId];
      availableSinceByPlayer[newPlayerId] = newPlayer?.availableSince ?? now;

      const nextMatches = get().queueState.activeMatches.map((item) =>
        item.id === matchId
          ? { ...item, playerIds: nextIds, availableSinceByPlayer }
          : item
      );
      const nextState = { ...get().queueState, activeMatches: nextMatches };
      set({ queueState: nextState });
      persist(nextState);

      const updatedPlayers = players.map((item) => {
        if (item.id === oldPlayerId) {
          return { ...item, availableSince: restoredSince, updatedAt: now };
        }
        if (item.id === newPlayerId) {
          return { ...item, availableSince: undefined, updatedAt: now };
        }
        return item;
      });
      usePlayerStore.getState().replaceAll(updatedPlayers);
      return true;
    },

    startMatchOnCourt: (entryId, courtId) => {
      const entry = get().queueState.queue.find((e) => e.id === entryId);
      if (!entry) return false;

      const court = useCourtStore.getState().courts.find((c) => c.id === courtId);
      if (!court || court.activeMatchId) return false;

      const nextState = queueService.startMatch(get().queueState, entry, courtId);
      const match = nextState.activeMatches[nextState.activeMatches.length - 1];
      if (!match) return false;

      set({ queueState: nextState });
      useCourtStore.getState().assignMatch(courtId, match.id);
      persist(nextState);
      return true;
    },

    playQueueEntry: (entryId) => {
      const openCourt = useCourtStore.getState().courts.find((c) => !c.activeMatchId);
      if (!openCourt) return false;
      return get().startMatchOnCourt(entryId, openCourt.id);
    },

    completeMatch: (matchId, winningTeam) => {
      const match = get().queueState.activeMatches.find((m) => m.id === matchId);
      if (!match) return false;

      const winnerPlayerIds = winnerIdsForTeam(match.playerIds, winningTeam);
      const { state: nextState } = matchService.completeMatch(
        get().queueState,
        matchId,
        winnerPlayerIds
      );

      const completedMatch = {
        ...match,
        status: 'completed' as const,
        winnerPlayerIds,
        completedAt: Date.now(),
      };
      const updatedPlayers = matchService.applyStats(
        usePlayerStore.getState().players,
        completedMatch
      );

      const freedCourtId = match.courtId;

      if (isStackModeActive()) {
        const routedState = handleStackModeCompleteMatch(nextState, match, winningTeam);
        set({ queueState: routedState });
        usePlayerStore.getState().replaceAll(updatedPlayers);

        if (freedCourtId) {
          useCourtStore.getState().clearCourt(freedCourtId);
        }

        persist(routedState);

        if (freedCourtId && !isRotationPaused(routedState)) {
          get().tryStartWinLoseStackMatch(freedCourtId);
        }
        return true;
      }

      if (isLadderModeActive()) {
        const courts = useCourtStore.getState().courts;
        const routedState = handleLadderModeCompleteMatch(
          nextState,
          match,
          winningTeam,
          courts
        );
        set({ queueState: routedState });
        usePlayerStore.getState().replaceAll(updatedPlayers);

        if (freedCourtId) {
          useCourtStore.getState().clearCourt(freedCourtId);
        }

        persist(routedState);
        syncLadderPlayerAvailability({
          unavailable: getLadderUnavailablePlayerIds(routedState),
        });

        if (freedCourtId && !isRotationPaused(routedState)) {
          get().tryStartLadderMatch(freedCourtId);
        }
        return true;
      }

      set({ queueState: nextState });
      usePlayerStore.getState().replaceAll(updatedPlayers);
      syncPlayerAvailability({ available: match.playerIds });

      if (match.courtId) {
        useCourtStore.getState().clearCourt(match.courtId);
      }

      persist(nextState);
      return true;
    },

    updateCompletedMatch: (matchId, update) => {
      const result = applyCompletedMatchCorrection(
        get().queueState,
        usePlayerStore.getState().players,
        matchId,
        update
      );

      if (!result) {
        return {
          ok: false,
          message: 'Could not update match — check gender rules and lineup.',
        };
      }

      set({ queueState: result.queueState });
      usePlayerStore.getState().replaceAll(result.players);
      persist(result.queueState);
      return { ok: true };
    },

    clearSessionQueue: () => {
      useQueueUiStore.getState().clearLadderStartNotices();
      const empty: QueueState = { ...emptyQueueState(), rotationPaused: true };
      set({ queueState: empty });
      persist(empty);
      const players = usePlayerStore.getState().players;
      const availableIds = queueService.getAvailablePlayers(players, empty).map((p) => p.id);
      syncPlayerAvailability({ available: availableIds });
    },

    stopRotation: () => {
      if (get().queueState.rotationPaused) return;
      const nextState: QueueState = { ...get().queueState, rotationPaused: true };
      set({ queueState: nextState });
      persist(nextState);
      useQueueUiStore.getState().clearLadderStartNotices();
    },

    resumeRotation: () => {
      if (!get().queueState.rotationPaused) return;
      const nextState: QueueState = { ...get().queueState, rotationPaused: false };
      set({ queueState: nextState });
      persist(nextState);
      if (isStackModeActive()) {
        get().reconcileWinLoseStackState();
        get().tryStartWinLoseStackMatch();
      }
      if (isLadderModeActive()) {
        get().reconcileLadderState();
      }
    },

    tryStartWinLoseStackMatch: (preferredCourtId) => {
      if (isRotationPaused(get().queueState)) return false;
      const { state, match } = tryStartWinLoseStackMatchFromStore(
        get().queueState,
        preferredCourtId
      );
      if (!match) return false;

      set({ queueState: state });
      persist(state);
      syncStackPlayerAvailability({ unavailable: match.playerIds });
      return true;
    },

    onPlayerCheckedInForStackMode: (playerId) => {
      if (!isStackModeActive()) return;

      const nextState = seedPlayerForStackMode(get().queueState, playerId);
      set({ queueState: nextState });
      persist(nextState);
      syncStackPlayerAvailability({ unavailable: [playerId] });
    },

    onPlayerRemovedFromStackMode: (playerId) => {
      if (!isStackModeActive()) return;

      const nextState = removePlayerForStackMode(get().queueState, playerId);
      if (nextState === get().queueState) return;

      set({ queueState: nextState });
      persist(nextState);
    },

    tryStartLadderMatch: (preferredCourtId) => {
      if (isRotationPaused(get().queueState)) return false;
      const { state, matches } = tryStartLadderMatchFromStore(
        get().queueState,
        preferredCourtId
      );
      if (matches.length === 0) return false;

      const courts = useCourtStore.getState().courts;
      const players = usePlayerStore.getState().players;
      useQueueUiStore.getState().pushLadderStartNotices(
        matches.map((match) => ({
          courtLabel: courts.find((court) => court.id === match.courtId)?.label ?? 'Court',
          playerNames: match.playerIds.map(
            (playerId) => players.find((player) => player.id === playerId)?.name ?? 'Unknown'
          ),
        }))
      );

      set({ queueState: state });
      persist(state);
      const unavailable = [
        ...matches.flatMap((match) => match.playerIds),
        ...getLadderUnavailablePlayerIds(state),
      ];
      syncLadderPlayerAvailability({ unavailable });
      return true;
    },

    onPlayerCheckedInForLadderMode: (playerId) => {
      if (!isLadderModeActive()) return;

      const players = usePlayerStore.getState().players;
      const nextState = seedPlayerForLadderMode(get().queueState, playerId, players);
      set({ queueState: nextState });
      persist(nextState);
      syncLadderPlayerAvailability({ unavailable: getLadderUnavailablePlayerIds(nextState) });
      if (!isRotationPaused(nextState)) {
        get().tryStartLadderMatch();
      }
    },

    onPlayerRemovedFromLadderMode: (playerId) => {
      if (!isLadderModeActive()) return;

      const nextState = removePlayerForLadderMode(get().queueState, playerId);
      if (nextState === get().queueState) return;

      set({ queueState: nextState });
      persist(nextState);
      syncLadderPlayerAvailability({ unavailable: getLadderUnavailablePlayerIds(nextState) });
    },

    resetForGameModeChange: (newMode) => {
      const current = get().queueState;
      const players = usePlayerStore.getState().players;
      const nextState = buildQueueStateForGameModeChange(current, newMode, players);
      const withRotationFlag: QueueState =
        newMode === 'win_lose_stack' || newMode === 'ladder_waterfall'
          ? { ...nextState, rotationPaused: false }
          : { ...nextState, rotationPaused: undefined };

      set({ queueState: withRotationFlag });
      persist(withRotationFlag);

      if (newMode !== 'ladder_waterfall') {
        useQueueUiStore.getState().clearLadderStartNotices();
      }

      if (newMode === 'win_lose_stack') {
        const checkedInIds = players.filter(isPlayerMatchable).map((player) => player.id);
        syncStackPlayerAvailability({ unavailable: checkedInIds });
        get().tryStartWinLoseStackMatch();
        return;
      }

      if (newMode === 'ladder_waterfall') {
        syncLadderPlayerAvailability({
          unavailable: getLadderUnavailablePlayerIds(withRotationFlag),
        });
        get().tryStartLadderMatch();
        return;
      }

      reconcileAvailableSince(withRotationFlag);
    },

    reconcileWinLoseStackState: () => {
      if (!isStackModeActive()) return;

      ensureCourtsForStackMode();
      const players = usePlayerStore.getState().players;
      const reconciled = reconcileStackWithCheckedInPlayers(get().queueState, players);
      if (reconciled === get().queueState) return;

      set({ queueState: reconciled });
      persist(reconciled);
      const stackIds = [
        ...(reconciled.winLoseStack?.winnerStack ?? []),
        ...(reconciled.winLoseStack?.loserStack ?? []),
      ];
      syncStackPlayerAvailability({ unavailable: stackIds });
    },

    reconcileLadderState: () => {
      if (!isLadderModeActive()) return;

      ensureCourtsForLadderMode();
      const players = usePlayerStore.getState().players;
      const courts = useCourtStore.getState().courts;
      const reconciled = reconcileLadderWithCheckedInPlayers(
        get().queueState,
        players,
        courts
      );
      if (reconciled === get().queueState) {
        if (!isRotationPaused(reconciled)) {
          get().tryStartLadderMatch();
        }
        return;
      }

      set({ queueState: reconciled });
      persist(reconciled);
      syncLadderPlayerAvailability({
        unavailable: getLadderUnavailablePlayerIds(reconciled),
      });
      if (!isRotationPaused(reconciled)) {
        get().tryStartLadderMatch();
      }
    },
  };
});
