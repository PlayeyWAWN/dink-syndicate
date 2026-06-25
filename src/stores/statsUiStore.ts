import { create } from 'zustand';
import { StatsView } from '@/types/player';

interface StatsUiState {
  statsView: StatsView;
  rankingsSearchQuery: string;
  rankingsPage: number;
  setStatsView: (view: StatsView) => void;
  setRankingsSearchQuery: (query: string) => void;
  setRankingsPage: (page: number) => void;
}

export const useStatsUiStore = create<StatsUiState>((set) => ({
  statsView: 'session',
  rankingsSearchQuery: '',
  rankingsPage: 0,
  setStatsView: (statsView) => set({ statsView, rankingsPage: 0 }),
  setRankingsSearchQuery: (rankingsSearchQuery) =>
    set({ rankingsSearchQuery, rankingsPage: 0 }),
  setRankingsPage: (rankingsPage) => set({ rankingsPage }),
}));
