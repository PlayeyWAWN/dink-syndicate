import { create } from 'zustand';
import { DEFAULT_ORGANIZER_NAME } from '@/config/constants';
import { courtService } from '@/modules/courts/CourtService';
import { useSessionStore } from '@/stores/sessionStore';
import { notifyQueuePersisted } from '@/modules/live/LivePublishService';
import { Court } from '@/types/court';

interface CourtStoreState {
  courts: Court[];
  hydrate: () => void;
  addCourt: (label?: string) => void;
  renameCourt: (courtId: string, label: string) => void;
  assignMatch: (courtId: string, matchId: string) => void;
  clearCourt: (courtId: string) => void;
  removeCourt: (courtId: string) => void;
  clearAllActiveMatches: () => void;
}

function persistCourts(courts: Court[]): void {
  const session = useSessionStore.getState();
  const snapshot = session.loadSnapshot();
  session.persistSnapshot({
    courts,
    settings: {
      courtCount: courts.length,
      organizerName:
        snapshot?.settings?.organizerName ??
        session.session?.organizerName ??
        DEFAULT_ORGANIZER_NAME,
    },
  });
  if (session.session?.publishEnabled) {
    notifyQueuePersisted();
  }
}

export const useCourtStore = create<CourtStoreState>((set, get) => ({
  courts: [],

  hydrate: () => {
    const snapshot = useSessionStore.getState().loadSnapshot();
    set({ courts: snapshot?.courts ?? [] });
  },

  addCourt: (label) => {
    const next = courtService.addCourt(get().courts, label);
    if (next.length === get().courts.length) return;
    set({ courts: next });
    persistCourts(next);
  },

  renameCourt: (courtId, label) => {
    const next = courtService.renameCourt(get().courts, courtId, label);
    set({ courts: next });
    persistCourts(next);
  },

  assignMatch: (courtId, matchId) => {
    const next = courtService.assignMatch(get().courts, courtId, matchId);
    set({ courts: next });
    persistCourts(next);
  },

  clearCourt: (courtId) => {
    const next = courtService.clearCourt(get().courts, courtId);
    set({ courts: next });
    persistCourts(next);
  },

  removeCourt: (courtId) => {
    const next = courtService.removeCourt(get().courts, courtId);
    if (next.length === get().courts.length) return;
    set({ courts: next });
    persistCourts(next);
  },

  clearAllActiveMatches: () => {
    const next = get().courts.map((court) =>
      court.activeMatchId ? { ...court, activeMatchId: null } : court
    );
    set({ courts: next });
    persistCourts(next);
  },
}));
