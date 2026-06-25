import { create } from 'zustand';
import { CourtFormat, QueueMatchMode } from '@/config/queue-match-modes';

interface QueueUiState {
  courtFormat: CourtFormat;
  matchMode: QueueMatchMode;
  selectedPlayerIds: string[];
  availableSearchQuery: string;
  excludedSearchQuery: string;
  availableSectionOpen: boolean;
  excludedSectionOpen: boolean;
  setCourtFormat: (format: CourtFormat) => void;
  setMatchMode: (mode: QueueMatchMode) => void;
  toggleSelectedPlayer: (playerId: string) => void;
  clearSelection: () => void;
  setAvailableSearchQuery: (query: string) => void;
  setExcludedSearchQuery: (query: string) => void;
  setAvailableSectionOpen: (open: boolean) => void;
  setExcludedSectionOpen: (open: boolean) => void;
}

export const useQueueUiStore = create<QueueUiState>((set, get) => ({
  courtFormat: 'doubles',
  matchMode: 'balanced',
  selectedPlayerIds: [],
  availableSearchQuery: '',
  excludedSearchQuery: '',
  availableSectionOpen: true,
  excludedSectionOpen: true,
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
}));

export type { CourtFormat, QueueMatchMode };
