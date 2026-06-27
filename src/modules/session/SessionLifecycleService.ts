import { livePublishService } from '@/modules/live/LivePublishService';
import {
  buildSessionArchive,
  hasSessionActivity,
} from '@/modules/session/session-archive-utils';
import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useSessionStore } from '@/stores/sessionStore';
import { defaultArchiveName } from '@/types/session-archive';

function clearSessionRuntimeState(forNewSession = false): void {
  useCourtStore.getState().clearAllActiveMatches();
  usePlayerStore.getState().resetSessionPlayerStats();
  if (forNewSession) {
    useQueueStore.getState().prepareQueueForNewSession();
  } else {
    useQueueStore.getState().clearSessionQueue();
  }
}

/** Saves current session stats to history without starting a new session. */
export function endSessionAndArchive(archiveName?: string): void {
  const snapshot = useSessionStore.getState().loadSnapshot();
  if (!snapshot) return;

  void livePublishService.disablePublish();

  const name = archiveName?.trim() || defaultArchiveName();
  const archive = buildSessionArchive(snapshot, name);
  useSessionStore.getState().appendSessionArchive(archive);
  clearSessionRuntimeState();
}

export interface StartNewSessionOptions {
  /** When set, archives the current session under this name before resetting. */
  archiveName?: string;
  /** When true and the session has activity, archives using a default name. */
  archiveCurrent?: boolean;
}

/** Archives optionally, clears queue/courts/session stats, and sets session start to now. */
export function startNewSession(options: StartNewSessionOptions = {}): void {
  void livePublishService.disablePublish();

  const snapshot = useSessionStore.getState().loadSnapshot();
  if (snapshot && (options.archiveName || (options.archiveCurrent && hasSessionActivity(snapshot)))) {
    const name = options.archiveName?.trim() || defaultArchiveName();
    const archive = buildSessionArchive(snapshot, name);
    useSessionStore.getState().appendSessionArchive(archive);
  }

  clearSessionRuntimeState(true);
  useSessionStore.getState().updateSessionSettings({ sessionStartTime: Date.now() });
}

export { hasSessionActivity };
