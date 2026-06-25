import { el } from '@/lib/dom-utils';
import {
  confirmWipeWithTypedPhrase,
  summarizeDataForWipe,
  wipeAllAppData,
  WIPE_BACKUP_REMINDER,
  WIPE_CONFIRMATION_PHRASE,
} from '@/modules/session/DataManagementService';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsUiStore } from '@/stores/settingsUiStore';
import { appRouter } from '@/app/router';
import { renderSettingsCollapsibleSection } from '@/ui/components/SettingsCollapsibleSection';

/** Danger zone — permanent local data wipe with typed confirmation. */
export function renderDataManagementPanel(): HTMLElement {
  const settingsUi = useSettingsUiStore.getState();
  const snapshot = useSessionStore.getState().loadSnapshot();
  const summary = summarizeDataForWipe(snapshot);

  const warning = el('div', { className: 'data-mgmt__warning' }, [
    el('p', { className: 'data-mgmt__warning-title' }, ['Permanent deletion']),
    el('p', { className: 'data-mgmt__warning-body' }, [
      'Deletes every player, match, queue entry, session archive, and career stat stored on this device. ',
      'There is no undo.',
    ]),
  ]);

  const backupNotice = el('div', { className: 'data-mgmt__backup-notice' }, [
    el('p', { className: 'data-mgmt__backup-notice-title' }, ['Export a backup first']),
    el('p', { className: 'data-mgmt__backup-notice-body' }, [WIPE_BACKUP_REMINDER]),
  ]);

  const impactList = el('ul', { className: 'data-mgmt__impact-list' });
  const impactItems = [
    `${summary.playerCount} player${summary.playerCount === 1 ? '' : 's'} and all career stats`,
    `${summary.queuedMatches} queued match${summary.queuedMatches === 1 ? '' : 'es'}`,
    `${summary.activeMatches} active match${summary.activeMatches === 1 ? '' : 'es'}`,
    `${summary.completedMatches} completed match${summary.completedMatches === 1 ? '' : 'es'} this session`,
    `${summary.archiveCount} archived session${summary.archiveCount === 1 ? '' : 's'}`,
    'All courts removed (add new ones on the Courts tab)',
    'Session timing cleared',
  ];
  for (const item of impactItems) {
    impactList.append(el('li', {}, [item]));
  }

  const deleteBtn = el('button', {
    type: 'button',
    className: 'btn btn-danger data-mgmt__delete-btn',
  }, ['Delete all app data…']);

  deleteBtn.addEventListener('click', () => {
    const latest = summarizeDataForWipe(useSessionStore.getState().loadSnapshot());
    if (!confirmWipeWithTypedPhrase(latest)) return;

    if (!wipeAllAppData()) {
      alert('Could not delete app data. Try again or reload the app.');
      return;
    }

    alert(
      'All app data on this device has been deleted.\n\n' +
        'You are starting with a clean slate — add players and courts when you are ready.'
    );
    appRouter.navigate('home');
  });

  const confirmHint = el('p', { className: 'screen-lead data-mgmt__confirm-hint' }, [
    `You will be asked to confirm twice, including typing ${WIPE_CONFIRMATION_PHRASE}.`,
  ]);

  return renderSettingsCollapsibleSection(
    [warning, backupNotice, impactList, confirmHint, deleteBtn],
    {
      title: 'Data management',
      open: settingsUi.dataManagementSectionOpen,
      onToggle: (open) => useSettingsUiStore.getState().setDataManagementSectionOpen(open),
    }
  );
}
