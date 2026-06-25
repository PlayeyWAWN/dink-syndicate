import { create } from 'zustand';
import { CourtFormat, QueueMatchMode } from '@/config/queue-match-modes';
import { createId } from '@/modules/matchmaking/create-id';

export interface LadderStartNotice {
  id: string;
  courtLabel: string;
  playerNames: string[];
  createdAt: number;
}

interface QueueUiState {
  courtFormat: CourtFormat;
  matchMode: QueueMatchMode;
  selectedPlayerIds: string[];
  availableSearchQuery: string;
  excludedSearchQuery: string;
  availableSectionOpen: boolean;
  excludedSectionOpen: boolean;
  ladderStartNotices: LadderStartNotice[];
  setCourtFormat: (format: CourtFormat) => void;
  setMatchMode: (mode: QueueMatchMode) => void;
  toggleSelectedPlayer: (playerId: string) => void;
  clearSelection: () => void;
  setAvailableSearchQuery: (query: string) => void;
  setExcludedSearchQuery: (query: string) => void;
  setAvailableSectionOpen: (open: boolean) => void;
  setExcludedSectionOpen: (open: boolean) => void;
  pushLadderStartNotices: (
    notices: Array<Pick<LadderStartNotice, 'courtLabel' | 'playerNames'>>
  ) => void;
  setLadderStartNotices: (notices: LadderStartNotice[]) => void;
  removeLadderStartNotice: (id: string) => void;
  clearLadderStartNotices: () => void;
}

export const useQueueUiStore = create<QueueUiState>((set, get) => ({
  courtFormat: 'doubles',
  matchMode: 'balanced',
  selectedPlayerIds: [],
  availableSearchQuery: '',
  excludedSearchQuery: '',
  availableSectionOpen: true,
  excludedSectionOpen: true,
  ladderStartNotices: [],
  setCourtFormat: (courtFormat) => set({ courtFormat, selectedPlayerIds: [] }),
  setMatchMode: (matchMode) => set({ matchMode, selectedPlayerIds: [] }),
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
  clearLadderStartNotices: () => set({ ladderStartNotices: [] }),
}));

export type { CourtFormat, QueueMatchMode };
