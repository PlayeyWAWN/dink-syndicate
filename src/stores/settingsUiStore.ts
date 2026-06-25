import { create } from 'zustand';

interface SettingsUiState {
  sessionSectionOpen: boolean;
  ttsSectionOpen: boolean;
  transferSectionOpen: boolean;
  appInfoSectionOpen: boolean;
  dataManagementSectionOpen: boolean;
  setSessionSectionOpen: (open: boolean) => void;
  setTtsSectionOpen: (open: boolean) => void;
  setTransferSectionOpen: (open: boolean) => void;
  setAppInfoSectionOpen: (open: boolean) => void;
  setDataManagementSectionOpen: (open: boolean) => void;
}

export const useSettingsUiStore = create<SettingsUiState>((set) => ({
  sessionSectionOpen: true,
  ttsSectionOpen: true,
  transferSectionOpen: true,
  appInfoSectionOpen: true,
  dataManagementSectionOpen: false,
  setSessionSectionOpen: (sessionSectionOpen) => set({ sessionSectionOpen }),
  setTtsSectionOpen: (ttsSectionOpen) => set({ ttsSectionOpen }),
  setTransferSectionOpen: (transferSectionOpen) => set({ transferSectionOpen }),
  setAppInfoSectionOpen: (appInfoSectionOpen) => set({ appInfoSectionOpen }),
  setDataManagementSectionOpen: (dataManagementSectionOpen) => set({ dataManagementSectionOpen }),
}));
