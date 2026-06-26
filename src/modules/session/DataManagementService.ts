import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { AppData } from '@/types/app-data';

export const WIPE_CONFIRMATION_PHRASE = 'DELETE';

/** Re-read persisted snapshot into runtime stores after import, wipe, or session lifecycle. */
export function reloadAllStores(): void {
  const snapshot = useSessionStore.getState().loadSnapshot();
  usePlayerStore.getState().hydrate();
  useCourtStore.getState().hydrate();
  useQueueStore.getState().hydrate();
  useQueueUiStore.getState().hydrateFromSettings(snapshot?.settings);
  useQueueUiStore.getState().clearSelection();
  useQueueUiStore.getState().setAvailableSearchQuery('');
  useQueueUiStore.getState().setExcludedSearchQuery('');
}

export interface WipeDataSummary {
  playerCount: number;
  archiveCount: number;
  queuedMatches: number;
  activeMatches: number;
  completedMatches: number;
}

export function summarizeDataForWipe(snapshot: AppData | null): WipeDataSummary {
  return {
    playerCount: snapshot?.players.length ?? 0,
    archiveCount: snapshot?.sessionArchives?.length ?? 0,
    queuedMatches: snapshot?.queueState.queue.length ?? 0,
    activeMatches: snapshot?.queueState.activeMatches.length ?? 0,
    completedMatches: snapshot?.queueState.completedMatches.length ?? 0,
  };
}

/** Permanently delete all roster, match, archive, and career data on this device. */
export function wipeAllAppData(): boolean {
  if (!useSessionStore.getState().wipeAllData()) return false;
  reloadAllStores();
  return true;
}

export const WIPE_BACKUP_REMINDER =
  'Strongly recommended: export a full session backup (Settings → Roster & courts transfer → Export full session JSON) before deleting. Once data is wiped, it cannot be recovered from this device.';

export function buildWipeConfirmationMessage(summary: WipeDataSummary): string {
  return (
    'Delete ALL app data on this device?\n\n' +
    `${WIPE_BACKUP_REMINDER}\n\n` +
    'This permanently removes:\n' +
    `• ${summary.playerCount} player${summary.playerCount === 1 ? '' : 's'} (including career stats)\n` +
    `• ${summary.queuedMatches} queued match${summary.queuedMatches === 1 ? '' : 'es'}\n` +
    `• ${summary.activeMatches} active match${summary.activeMatches === 1 ? '' : 'es'}\n` +
    `• ${summary.completedMatches} completed match${summary.completedMatches === 1 ? '' : 'es'} this session\n` +
    `• ${summary.archiveCount} archived session${summary.archiveCount === 1 ? '' : 's'}\n\n` +
    'Court count reset to zero. Your organizer name is kept. All courts are removed. This cannot be undone.'
  );
}

export function confirmWipeWithTypedPhrase(summary: WipeDataSummary): boolean {
  if (!window.confirm(buildWipeConfirmationMessage(summary))) return false;

  const typed = window.prompt(
    `${WIPE_BACKUP_REMINDER}\n\n` +
      `If you have not exported a full session backup yet, tap Cancel now and do that first.\n\n` +
      `Type ${WIPE_CONFIRMATION_PHRASE} to confirm permanent deletion:`,
    ''
  );
  return typed?.trim().toUpperCase() === WIPE_CONFIRMATION_PHRASE;
}
