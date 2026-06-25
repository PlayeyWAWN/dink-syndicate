import { create } from 'zustand';

interface SettingsUiState {
  accountSectionOpen: boolean;
  organizerSectionOpen: boolean;
  sessionSectionOpen: boolean;
  ttsSectionOpen: boolean;
  transferSectionOpen: boolean;
  appInfoSectionOpen: boolean;
  dataManagementSectionOpen: boolean;
  setAccountSectionOpen: (open: boolean) => void;
  setOrganizerSectionOpen: (open: boolean) => void;
  setSessionSectionOpen: (open: boolean) => void;
  setTtsSectionOpen: (open: boolean) => void;
  setTransferSectionOpen: (open: boolean) => void;
  setAppInfoSectionOpen: (open: boolean) => void;
  setDataManagementSectionOpen: (open: boolean) => void;
}

export const useSettingsUiStore = create<SettingsUiState>((set) => ({
  accountSectionOpen: false,
  organizerSectionOpen: false,
  sessionSectionOpen: true,
  ttsSectionOpen: true,
  transferSectionOpen: true,
  appInfoSectionOpen: true,
  dataManagementSectionOpen: true,
  setAccountSectionOpen: (accountSectionOpen) => set({ accountSectionOpen }),
  setOrganizerSectionOpen: (organizerSectionOpen) => set({ organizerSectionOpen }),
  setSessionSectionOpen: (sessionSectionOpen) => set({ sessionSectionOpen }),
  setTtsSectionOpen: (ttsSectionOpen) => set({ ttsSectionOpen }),
  setTransferSectionOpen: (transferSectionOpen) => set({ transferSectionOpen }),
  setAppInfoSectionOpen: (appInfoSectionOpen) => set({ appInfoSectionOpen }),
  setDataManagementSectionOpen: (dataManagementSectionOpen) => set({ dataManagementSectionOpen }),
}));
