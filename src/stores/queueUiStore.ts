import { create } from 'zustand';
import { CourtFormat, QueueMatchMode } from '@/config/queue-match-modes';
import { createId } from '@/modules/matchmaking/create-id';
import { WIN_LOSE_STACK_PLAYERS } from '@/modules/game-mode/winLoseStackMode';
import { useSessionStore } from '@/stores/sessionStore';
import { AppSettings } from '@/types/app-data';

export interface LadderStartNotice {
  id: string;
  courtLabel: string;
  playerNames: string[];
  createdAt: number;
}

/** Slot selected for replace/swap in a staged lineup. */
export interface StackSwapTarget {
  lineupIndex: number;
  slotIndex: number;
}

interface QueueUiState {
  courtFormat: CourtFormat;
  matchMode: QueueMatchMode;
  selectedPlayerIds: string[];
  availableSearchQuery: string;
  excludedSearchQuery: string;
  availableSectionOpen: boolean;
  excludedSectionOpen: boolean;
  liveWallboardSectionOpen: boolean;
  ladderStartNotices: LadderStartNotice[];
  ladderSelectedPoolPlayerId: string | null;
  /** Fully staged Next Lineups — each entry is 1–4 player ids (Team 1 then Team 2). */
  stackStagedLineups: string[][];
  /**
   * When each lineup first became complete (4/4). Kept across in-place swaps;
   * cleared if the lineup drops below 4.
   */
  stackLineupFilledAt: Array<number | undefined>;
  /** Filled slot awaiting a waiting-player tap to swap. */
  stackSwapTarget: StackSwapTarget | null;
  setCourtFormat: (format: CourtFormat) => void;
  setMatchMode: (mode: QueueMatchMode) => void;
  toggleSelectedPlayer: (playerId: string) => void;
  clearSelection: () => void;
  setAvailableSearchQuery: (query: string) => void;
  setExcludedSearchQuery: (query: string) => void;
  setAvailableSectionOpen: (open: boolean) => void;
  setExcludedSectionOpen: (open: boolean) => void;
  setLiveWallboardSectionOpen: (open: boolean) => void;
  pushLadderStartNotices: (
    notices: Array<Pick<LadderStartNotice, 'courtLabel' | 'playerNames'>>
  ) => void;
  setLadderStartNotices: (notices: LadderStartNotice[]) => void;
  removeLadderStartNotice: (id: string) => void;
  clearLadderStartNotices: () => void;
  setLadderSelectedPoolPlayer: (playerId: string | null) => void;
  clearLadderSelection: () => void;
  toggleStackSelectedPlayer: (playerId: string, eligibleIds: string[]) => void;
  setStackSwapTarget: (target: StackSwapTarget | null) => void;
  replaceStagedLineupPlayer: (
    lineupIndex: number,
    oldPlayerId: string,
    newPlayerId: string
  ) => void;
  swapStagedLineupPlayers: (
    lineupIndex: number,
    playerIdA: string,
    playerIdB: string
  ) => void;
  setStackStagedLineups: (lineups: string[][]) => void;
  removeStagedLineup: (lineupIndex: number) => void;
  /** @deprecated Prefer setStackStagedLineups — kept for single-lineup prune helpers. */
  setStackSelectedPlayerIds: (ids: string[]) => void;
  clearStackSelection: () => void;
  pruneStackStagedLineups: (eligibleIds: string[]) => void;
  drainCompleteStagedLineups: (count: number) => void;
  syncStackDefaultSelection: (eligibleIds?: string[]) => void;
  hydrateFromSettings: (settings?: AppSettings) => void;
}

/** Flatten staged lineups into a single id list (order preserved). */
export function flattenStagedLineups(lineups: string[][]): string[] {
  return lineups.flat();
}

/** Lineups that already have a full 4-player roster. */
export function getCompleteStagedLineups(lineups: string[][]): string[][] {
  return lineups.filter(
    (lineup) =>
      lineup.length === WIN_LOSE_STACK_PLAYERS && new Set(lineup).size === WIN_LOSE_STACK_PLAYERS
  );
}

/** Drop empty lineups so the UI only shows cards with players. */
export function compactStagedLineups(lineups: string[][]): string[][] {
  return lineups.map((lineup) => [...lineup]).filter((lineup) => lineup.length > 0);
}

function isCompleteLineup(lineup: string[]): boolean {
  return lineup.length === WIN_LOSE_STACK_PLAYERS && new Set(lineup).size === WIN_LOSE_STACK_PLAYERS;
}

/**
 * Align filledAt with lineups: stamp when first complete, keep on swap,
 * clear when incomplete.
 */
export function syncLineupFilledAt(
  lineups: string[][],
  previous: Array<number | undefined>,
  now = Date.now()
): Array<number | undefined> {
  return lineups.map((lineup, index) => {
    if (!isCompleteLineup(lineup)) return undefined;
    return previous[index] ?? now;
  });
}

function withLineups(
  lineups: string[][],
  previousFilledAt: Array<number | undefined>,
  swapTarget: StackSwapTarget | null = null
): Pick<QueueUiState, 'stackStagedLineups' | 'stackLineupFilledAt' | 'stackSwapTarget'> {
  const compacted = compactStagedLineups(lineups);
  return {
    stackStagedLineups: compacted,
    stackLineupFilledAt: syncLineupFilledAt(compacted, previousFilledAt),
    stackSwapTarget: swapTarget,
  };
}

export const useQueueUiStore = create<QueueUiState>((set, get) => ({
  courtFormat: 'doubles',
  matchMode: 'balanced',
  selectedPlayerIds: [],
  availableSearchQuery: '',
  excludedSearchQuery: '',
  availableSectionOpen: true,
  excludedSectionOpen: false,
  liveWallboardSectionOpen: false,
  ladderStartNotices: [],
  ladderSelectedPoolPlayerId: null,
  stackStagedLineups: [],
  stackLineupFilledAt: [],
  stackSwapTarget: null,
  setCourtFormat: (courtFormat) => {
    set({ courtFormat, selectedPlayerIds: [] });
    useSessionStore.getState().updateSessionSettings({ courtFormat });
  },
  setMatchMode: (matchMode) => {
    set({ matchMode, selectedPlayerIds: [] });
    useSessionStore.getState().updateSessionSettings({ matchMode });
  },
  toggleSelectedPlayer: (playerId) => {
    const current = get().selectedPlayerIds;
    if (current.includes(playerId)) {
      set({ selectedPlayerIds: current.filter((id) => id !== playerId) });
      return;
    }
    set({ selectedPlayerIds: [...current, playerId] });
  },
  clearSelection: () => set({ selectedPlayerIds: [] }),
  setAvailableSearchQuery: (availableSearchQuery) => set({ availableSearchQuery }),
  setExcludedSearchQuery: (excludedSearchQuery) => set({ excludedSearchQuery }),
  setAvailableSectionOpen: (availableSectionOpen) => set({ availableSectionOpen }),
  setExcludedSectionOpen: (excludedSectionOpen) => set({ excludedSectionOpen }),
  setLiveWallboardSectionOpen: (liveWallboardSectionOpen) => set({ liveWallboardSectionOpen }),
  pushLadderStartNotices: (notices) => {
    if (notices.length === 0) return;
    const now = Date.now();
    const next = notices.map((notice) => ({
      ...notice,
      id: createId('ladder-notice'),
      createdAt: now,
    }));
    set((state) => ({ ladderStartNotices: [...state.ladderStartNotices, ...next] }));
  },
  setLadderStartNotices: (ladderStartNotices) => set({ ladderStartNotices }),
  removeLadderStartNotice: (id) =>
    set((state) => ({
      ladderStartNotices: state.ladderStartNotices.filter((notice) => notice.id !== id),
    })),
  clearLadderStartNotices: () => set({ ladderStartNotices: [], ladderSelectedPoolPlayerId: null }),
  setLadderSelectedPoolPlayer: (playerId) => set({ ladderSelectedPoolPlayerId: playerId }),
  clearLadderSelection: () => set({ ladderSelectedPoolPlayerId: null }),
  setStackSwapTarget: (stackSwapTarget) => set({ stackSwapTarget }),
  replaceStagedLineupPlayer: (lineupIndex, oldPlayerId, newPlayerId) => {
    const { stackStagedLineups, stackLineupFilledAt } = get();
    const lineup = stackStagedLineups[lineupIndex];
    if (!lineup) return;
    const slotIndex = lineup.indexOf(oldPlayerId);
    if (slotIndex < 0) return;
    if (lineup.includes(newPlayerId)) return;
    const next = stackStagedLineups.map((entry, index) =>
      index === lineupIndex ? entry.map((id, i) => (i === slotIndex ? newPlayerId : id)) : [...entry]
    );
    set(withLineups(next, stackLineupFilledAt, null));
  },
  swapStagedLineupPlayers: (lineupIndex, playerIdA, playerIdB) => {
    const { stackStagedLineups, stackLineupFilledAt } = get();
    const lineup = stackStagedLineups[lineupIndex];
    if (!lineup) return;
    const indexA = lineup.indexOf(playerIdA);
    const indexB = lineup.indexOf(playerIdB);
    if (indexA < 0 || indexB < 0) return;
    const nextLineup = [...lineup];
    [nextLineup[indexA], nextLineup[indexB]] = [nextLineup[indexB]!, nextLineup[indexA]!];
    const next = stackStagedLineups.map((entry, index) =>
      index === lineupIndex ? nextLineup : [...entry]
    );
    set(withLineups(next, stackLineupFilledAt, null));
  },
  toggleStackSelectedPlayer: (playerId, eligibleIds) => {
    if (!eligibleIds.includes(playerId)) return;
    const state = get();
    const swap = state.stackSwapTarget;
    let lineups = state.stackStagedLineups.map((lineup) => [...lineup]);
    const filledAt = [...state.stackLineupFilledAt];

    // Swap/replace into a selected lineup slot.
    if (swap) {
      const lineup = lineups[swap.lineupIndex];
      if (!lineup || swap.slotIndex < 0 || swap.slotIndex >= lineup.length) {
        set({ stackSwapTarget: null });
        return;
      }
      if (lineup.includes(playerId)) {
        set({ stackSwapTarget: null });
        return;
      }
      lineup[swap.slotIndex] = playerId;
      lineups[swap.lineupIndex] = lineup;
      set(withLineups(lineups, filledAt, null));
      return;
    }

    // Already staged — ignore (use slot tap to swap, Clear to remove).
    if (lineups.some((lineup) => lineup.includes(playerId))) {
      return;
    }

    const incompleteIndex = lineups.findIndex((lineup) => lineup.length < WIN_LOSE_STACK_PLAYERS);
    if (incompleteIndex >= 0) {
      lineups[incompleteIndex] = [...lineups[incompleteIndex]!, playerId];
      set(withLineups(lineups, filledAt, null));
      return;
    }

    // All current lineups are full — start another (unlimited).
    lineups = [...lineups, [playerId]];
    set(withLineups(lineups, filledAt, null));
  },
  setStackStagedLineups: (lineups) => {
    const { stackLineupFilledAt } = get();
    set(withLineups(lineups, stackLineupFilledAt, null));
  },
  removeStagedLineup: (lineupIndex) => {
    const { stackStagedLineups, stackLineupFilledAt } = get();
    const next = stackStagedLineups.filter((_, index) => index !== lineupIndex);
    const nextFilled = stackLineupFilledAt.filter((_, index) => index !== lineupIndex);
    set({
      stackStagedLineups: compactStagedLineups(next),
      stackLineupFilledAt: syncLineupFilledAt(compactStagedLineups(next), nextFilled),
      stackSwapTarget: null,
    });
  },
  setStackSelectedPlayerIds: (ids) => {
    const first = ids.slice(0, WIN_LOSE_STACK_PLAYERS);
    const rest = get().stackStagedLineups.slice(1);
    const restFilled = get().stackLineupFilledAt.slice(1);
    set(withLineups([first, ...rest], [undefined, ...restFilled], null));
  },
  clearStackSelection: () =>
    set({ stackStagedLineups: [], stackLineupFilledAt: [], stackSwapTarget: null }),
  pruneStackStagedLineups: (eligibleIds) => {
    const eligible = new Set(eligibleIds);
    const { stackStagedLineups, stackLineupFilledAt } = get();
    const nextLineups: string[][] = [];
    const nextFilled: Array<number | undefined> = [];
    stackStagedLineups.forEach((lineup, index) => {
      const pruned = lineup.filter((id) => eligible.has(id));
      if (pruned.length === 0) return;
      nextLineups.push(pruned);
      nextFilled.push(isCompleteLineup(pruned) ? stackLineupFilledAt[index] : undefined);
    });
    set({
      stackStagedLineups: nextLineups,
      stackLineupFilledAt: syncLineupFilledAt(nextLineups, nextFilled),
      stackSwapTarget: null,
    });
  },
  drainCompleteStagedLineups: (count) => {
    if (count <= 0) return;
    const lineups = [...get().stackStagedLineups];
    const filledAt = [...get().stackLineupFilledAt];
    let remaining = count;
    const nextLineups: string[][] = [];
    const nextFilledAt: Array<number | undefined> = [];
    for (let i = 0; i < lineups.length; i++) {
      const lineup = lineups[i]!;
      const complete = isCompleteLineup(lineup);
      if (complete && remaining > 0) {
        remaining -= 1;
        continue;
      }
      nextLineups.push([...lineup]);
      nextFilledAt.push(filledAt[i]);
    }
    set({
      ...withLineups(nextLineups, nextFilledAt, null),
    });
  },
  /** Kept for callers that still sync; manual mode no longer auto-fills. */
  syncStackDefaultSelection: (_eligibleIds?: string[]) =>
    set({ stackStagedLineups: [], stackLineupFilledAt: [], stackSwapTarget: null }),
  hydrateFromSettings: (settings) => {
    const courtFormat: CourtFormat =
      settings?.courtFormat === 'singles' ? 'singles' : 'doubles';
    const matchMode: QueueMatchMode =
      settings?.matchMode === 'mixed_doubles'
        ? 'mixed_doubles'
        : settings?.matchMode === 'same_gender'
          ? 'same_gender'
          : 'balanced';
    set({ courtFormat, matchMode });
  },
}));
