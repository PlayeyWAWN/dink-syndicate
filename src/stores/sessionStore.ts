import { create } from 'zustand';
import { DEFAULT_COURT_COUNT, DEFAULT_ORGANIZER_NAME, STORAGE_KEYS } from '@/config/constants';
import { getAuthService } from '@/modules/auth/getAuthService';
import { isFirebaseEnabled } from '@/config/firebase';
import { courtService } from '@/modules/courts/CourtService';
import { localStorageService } from '@/services/LocalStorageService';
import { readEnhancedData, setActiveStorageUid } from '@/services/storage-scope';
import {
  courtsFromRosterPayload,
  rosterPlayerToPlayer,
  RosterTransferPayload,
} from '@/modules/session/RosterTransferService';
import { AppData, APP_DATA_VERSION, AppSettings, mergeAppSettings, migrateAppData } from '@/types/app-data';
import { Court } from '@/types/court';
import { Player } from '@/types/player';
import { QueueState } from '@/types/queue';
import { Session } from '@/types/session';
import { SessionArchive } from '@/types/session-archive';

interface SessionStoreState {
  session: Session | null;
  hydrated: boolean;
  init: () => Promise<void>;
  /** Activate a signed-in session (Firebase auth or after local sign-in). */
  activateSession: (session: Session) => Promise<void>;
  /** Clear session on sign-out (Firebase). */
  clearSession: () => void;
  setOrganizerName: (name: string) => void;
  updateSessionSettings: (partial: Partial<AppSettings>) => void;
  persistSnapshot: (partial: {
    players?: Player[];
    courts?: Court[];
    queueState?: QueueState;
    settings?: Partial<AppSettings>;
    sessionArchives?: SessionArchive[];
  }) => void;
  loadSnapshot: () => AppData | null;
  appendSessionArchive: (archive: SessionArchive) => void;
  getSessionArchives: () => SessionArchive[];
  importSnapshot: (data: AppData) => void;
  importRoster: (payload: RosterTransferPayload) => void;
  /** Irreversible — resets players, matches, archives, and career stats to defaults. */
  wipeAllData: () => boolean;
}

function buildDefaultAppData(session: Session): AppData {
  return {
    version: APP_DATA_VERSION,
    session,
    players: [],
    courts: courtService.ensureCourts([], DEFAULT_COURT_COUNT),
    queueState: { queue: [], activeMatches: [], completedMatches: [] },
    settings: mergeAppSettings(undefined, session.organizerName || DEFAULT_ORGANIZER_NAME),
    sessionArchives: [],
  };
}

/** Empty slate after permanent data wipe — no default courts. */
function buildWipedAppData(session: Session): AppData {
  return {
    version: APP_DATA_VERSION,
    session,
    players: [],
    courts: [],
    queueState: { queue: [], activeMatches: [], completedMatches: [] },
    settings: mergeAppSettings(undefined, session.organizerName || DEFAULT_ORGANIZER_NAME, {
      sessionStartTime: Date.now(),
      courtCount: 0,
    }),
    sessionArchives: [],
  };
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  session: null,
  hydrated: false,

  init: async () => {
    if (isFirebaseEnabled()) return;

    const auth = getAuthService();
    const session = await auth.signIn();
    await get().activateSession(session);
  },

  activateSession: async (session: Session) => {
    setActiveStorageUid(session.id);

    const existingRaw = readEnhancedData<Record<string, unknown>>(session.id);
    if (!existingRaw) {
      localStorageService.save(buildDefaultAppData(session), session.id);
    } else {
      const existingVersion =
        typeof existingRaw.version === 'number' ? existingRaw.version : 1;
      const migrated = migrateAppData(existingRaw);
      if (existingVersion < APP_DATA_VERSION) {
        localStorageService.save(migrated, session.id);
      }
    }

    set({ session, hydrated: true });
  },

  clearSession: () => {
    setActiveStorageUid(null);
    set({ session: null, hydrated: false });
  },

  setOrganizerName: (name) => {
    const updated = getAuthService().updateOrganizerName(name);
    setActiveStorageUid(updated.id);
    set({ session: updated });
    get().persistSnapshot({ settings: { organizerName: updated.organizerName } });
  },

  updateSessionSettings: (partial) => {
    get().persistSnapshot({ settings: partial });
  },

  persistSnapshot: (partial) => {
    const { session } = get();
    if (!session) return;
    const current = localStorageService.load(session.id) ?? buildDefaultAppData(session);
    const next: AppData = {
      ...current,
      version: APP_DATA_VERSION,
      session,
      players: partial.players ?? current.players,
      courts: partial.courts ?? current.courts,
      queueState: partial.queueState ?? current.queueState,
      sessionArchives: partial.sessionArchives ?? current.sessionArchives ?? [],
      settings: mergeAppSettings(current.settings, session.organizerName, partial.settings),
    };
    localStorageService.save(next, session.id);
  },

  loadSnapshot: () => {
    const { session } = get();
    if (!session) return null;
    return localStorageService.load(session.id);
  },

  appendSessionArchive: (archive) => {
    const current = get().loadSnapshot();
    if (!current) return;
    get().persistSnapshot({
      sessionArchives: [...(current.sessionArchives ?? []), archive],
    });
  },

  getSessionArchives: () => {
    return get().loadSnapshot()?.sessionArchives ?? [];
  },

  importSnapshot: (data) => {
    const { session } = get();
    if (!session) return;
    const parsed = migrateAppData(data);
    const merged: AppData = {
      ...parsed,
      session,
      settings: mergeAppSettings(parsed.settings, session.organizerName, {
        courtCount: parsed.settings?.courtCount,
        sessionStartTime: parsed.settings?.sessionStartTime,
        arrivalGraceMinutes: parsed.settings?.arrivalGraceMinutes,
        arrivalPenaltyEnabled: parsed.settings?.arrivalPenaltyEnabled,
        lateMinutesWeight: parsed.settings?.lateMinutesWeight,
        availableWaitWarnMinutes: parsed.settings?.availableWaitWarnMinutes,
        availableWaitCriticalMinutes: parsed.settings?.availableWaitCriticalMinutes,
        ttsVoiceUri: parsed.settings?.ttsVoiceUri,
        gameMode: parsed.settings?.gameMode,
        courtFormat: parsed.settings?.courtFormat,
        matchMode: parsed.settings?.matchMode,
      }),
    };
    localStorageService.save(merged, session.id);
  },

  importRoster: (payload: RosterTransferPayload) => {
    const { session } = get();
    if (!session) return;

    const players = payload.players.map(rosterPlayerToPlayer);
    const courts = courtsFromRosterPayload(payload);

    get().persistSnapshot({
      players,
      courts,
      settings: { courtCount: payload.courtCount },
    });
  },

  wipeAllData: () => {
    const { session } = get();
    if (!session) return false;
    const fresh = buildWipedAppData(session);
    localStorageService.save(fresh, session.id);
    // Drop legacy global snapshot so readEnhancedData cannot resurrect old courts.
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ENHANCED_DATA);
    }
    return true;
  },
}));
