import { create } from 'zustand';

import { playerService } from '@/modules/players/PlayerService';
import {
  GenerateTestRosterOptions,
} from '@/modules/players/generateTestRoster';

import { useSessionStore } from '@/stores/sessionStore';
import { useQueueStore } from '@/stores/queueStore';
import { notifyQueuePersisted } from '@/modules/live/LivePublishService';
import { pruneSynergyPairs, pruneSynergyTeamNames } from '@/modules/matchmaking/synergyTeam';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import { isLadderWaterfallMode, isWinLoseStackMode } from '@/types/game-mode';

import { Player, PlayerGender, isPlayerMatchable } from '@/types/player';



function syncSynergyPairsFromRoster(players: Player[]): void {
  const settings = useSessionStore.getState().loadSnapshot()?.settings;
  if (!settings?.synergyPairs?.length) return;

  const matchableIds = new Set(players.filter(isPlayerMatchable).map((player) => player.id));
  const pruned = pruneSynergyPairs(settings.synergyPairs, matchableIds);
  const prunedNames = pruneSynergyTeamNames(settings.synergyTeamNames ?? {}, pruned);

  if (
    pruned.length !== settings.synergyPairs.length ||
    Object.keys(prunedNames).length !== Object.keys(settings.synergyTeamNames ?? {}).length
  ) {
    useSessionStore.getState().updateSessionSettings({
      synergyPairs: pruned,
      synergyTeamNames: prunedNames,
    });
  }
}

interface PlayerStoreState {

  players: Player[];

  hydrate: () => void;

  addPlayer: (name: string, duprDoublesRating?: number, gender?: PlayerGender) => void;

  bulkAddPlayers: (

    names: string[],

    duprDoublesRating: number,

    gender: PlayerGender

  ) => { added: number; skipped: string[] };

  updatePlayer: (

    playerId: string,

    input: { name?: string; gender?: PlayerGender; duprDoublesRating?: number }

  ) => void;

  removePlayer: (playerId: string) => void;

  toggleCheckIn: (playerId: string) => void;

  setExcluded: (playerId: string, excluded: boolean) => void;

  pausePlayer: (playerId: string, durationMs: number) => void;

  returnFromBreak: (playerId: string) => void;

  includeAllPlayers: () => void;

  updateDuprRating: (playerId: string, doublesRating: number) => void;

  replaceAll: (players: Player[]) => void;
  resetSessionPlayerStats: () => void;
  loadTestRoster: (options?: GenerateTestRosterOptions) => { added: number; skipped: number };
}



function persist(players: Player[]): void {

  useSessionStore.getState().persistSnapshot({ players });
  if (useSessionStore.getState().session?.publishEnabled) {
    notifyQueuePersisted();
  }

}



function syncGameModeForPlayer(playerId: string, player: Player | undefined): void {
  const settings = useSessionStore.getState().loadSnapshot()?.settings;
  const gameMode = getGameMode(settings);
  const queue = useQueueStore.getState();

  if (isWinLoseStackMode(gameMode)) {
    if (player && isPlayerMatchable(player)) {
      queue.onPlayerCheckedInForStackMode(playerId);
    } else {
      queue.onPlayerRemovedFromStackMode(playerId);
    }
    return;
  }

  if (isLadderWaterfallMode(gameMode)) {
    if (player && isPlayerMatchable(player)) {
      queue.onPlayerCheckedInForLadderMode(playerId);
    } else {
      queue.onPlayerRemovedFromLadderMode(playerId);
    }
  }
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => ({

  players: [],



  hydrate: () => {

    const snapshot = useSessionStore.getState().loadSnapshot();

    const players = playerService.clearExpiredPauses(snapshot?.players ?? []);

    set({ players });

    if (players !== snapshot?.players) {
      persist(players);
    }

  },



  addPlayer: (name, duprDoublesRating, gender) => {

    const next = playerService.addPlayer(get().players, name, duprDoublesRating, gender);

    set({ players: next });

    persist(next);

  },



  bulkAddPlayers: (names, duprDoublesRating, gender) => {

    const result = playerService.bulkAddPlayers(get().players, names, duprDoublesRating, gender);

    set({ players: result.players });

    persist(result.players);

    return { added: result.added, skipped: result.skipped };

  },



  updatePlayer: (playerId, input) => {

    const next = playerService.updatePlayer(get().players, playerId, input);

    set({ players: next });

    persist(next);

  },



  removePlayer: (playerId) => {

    const next = playerService.removePlayer(get().players, playerId);

    set({ players: next });

    persist(next);

    syncSynergyPairsFromRoster(next);

    useQueueStore.getState().onPlayerRemovedFromStackMode(playerId);

  },



  toggleCheckIn: (playerId) => {

    const next = playerService.toggleCheckIn(get().players, playerId);

    set({ players: next });

    persist(next);

    syncSynergyPairsFromRoster(next);

    const player = next.find((item) => item.id === playerId);
    syncGameModeForPlayer(playerId, player);

  },



  setExcluded: (playerId, excluded) => {

    const next = playerService.setExcluded(get().players, playerId, excluded);

    set({ players: next });

    persist(next);

    syncSynergyPairsFromRoster(next);

    const player = next.find((item) => item.id === playerId);
    syncGameModeForPlayer(playerId, player);

  },



  pausePlayer: (playerId, durationMs) => {

    const next = playerService.pausePlayer(get().players, playerId, durationMs);

    set({ players: next });

    persist(next);

    useQueueStore.getState().onPlayerRemovedFromStackMode(playerId);

  },



  returnFromBreak: (playerId) => {

    const next = playerService.returnFromBreak(get().players, playerId);

    set({ players: next });

    persist(next);

    const player = next.find((item) => item.id === playerId);
    syncGameModeForPlayer(playerId, player);

  },



  includeAllPlayers: () => {

    const next = playerService.includeAllPlayers(get().players);

    set({ players: next });

    persist(next);

  },



  updateDuprRating: (playerId, doublesRating) => {

    const next = playerService.updateDuprRating(get().players, playerId, doublesRating);

    set({ players: next });

    persist(next);

  },



  replaceAll: (players) => {
    set({ players });
    persist(players);
  },

  resetSessionPlayerStats: () => {
    const now = Date.now();
    const next = get().players.map((player) => ({
      ...player,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pausedUntil: undefined,
      availableSince: player.checkedIn && !player.excluded ? now : undefined,
      updatedAt: now,
    }));
    set({ players: next });
    persist(next);
  },

  loadTestRoster: (options) => {
    const result = playerService.addTestRoster(get().players, options);
    set({ players: result.players });
    persist(result.players);
    return { added: result.added, skipped: result.skipped };
  },
}));

