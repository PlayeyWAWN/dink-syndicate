import { create } from 'zustand';

export type PlayerSortField = 'name' | 'gender' | 'skill' | 'games' | 'wins';
export type PlayerGenderFilter = 'all' | 'male' | 'female';
export type PlayerStatusFilter = 'all' | 'active' | 'excluded' | 'checked_out';

interface PlayersUiState {
  searchQuery: string;
  sortBy: PlayerSortField;
  sortDescending: boolean;
  genderFilter: PlayerGenderFilter;
  statusFilter: PlayerStatusFilter;
  setSearchQuery: (query: string) => void;
  setSortBy: (field: PlayerSortField) => void;
  setSortDescending: (descending: boolean) => void;
  setGenderFilter: (filter: PlayerGenderFilter) => void;
  setStatusFilter: (filter: PlayerStatusFilter) => void;
}

export const usePlayersUiStore = create<PlayersUiState>((set) => ({
  searchQuery: '',
  sortBy: 'name',
  sortDescending: false,
  genderFilter: 'all',
  statusFilter: 'all',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortDescending: (sortDescending) => set({ sortDescending }),
  setGenderFilter: (genderFilter) => set({ genderFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
}));
