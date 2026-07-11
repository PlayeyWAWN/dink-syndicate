import { MATCHMAKING_FAIRNESS } from '@/config/matchmaking';
import {
  TEST_ROSTER_COUNT_OPTIONS,
  TEST_ROSTER_SIZE,
} from '@/modules/players/generateTestRoster';
import { el } from '@/lib/dom-utils';
import { computeLateMinutesForCheckIn } from '@/lib/session-settings-utils';
import { startNewSession, endSessionAndArchive, hasSessionActivity } from '@/modules/session/SessionLifecycleService';
import { defaultArchiveName } from '@/types/session-archive';
import {
  defaultExportFilename,
  downloadJson,
  parseImportJson,
  serializeExport,
} from '@/modules/session/SessionTransferService';
import {
  defaultRosterExportFilename,
  parseRosterImportJson,
  serializeRosterExport,
} from '@/modules/session/RosterTransferService';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { isAutoRotationEnabled } from '@/types/queue';
import { useSessionStore } from '@/stores/sessionStore';
import { mergeAppSettings } from '@/types/app-data';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import { isLadderWaterfallMode, isWinLoseStackMode } from '@/types/game-mode';
import { appRouter } from '@/app/router';
import { renderSettingsCollapsibleSection } from '@/ui/components/SettingsCollapsibleSection';
import { renderTtsSettingsPanel } from '@/ui/components/TtsSettingsPanel';
import { reloadAllStores } from '@/modules/session/DataManagementService';
import { renderAppInformationPanel } from '@/ui/components/AppInformationPanel';
import { renderAccountSettingsPanel } from '@/ui/components/AccountSettingsPanel';
import { renderDataManagementPanel } from '@/ui/components/DataManagementPanel';
import { renderGameModeSettingsSection } from '@/ui/components/GameModeSettingsPanel';
import { renderSponsorSettingsPanel } from '@/ui/components/SponsorSettingsPanel';
import { useSettingsUiStore } from '@/stores/settingsUiStore';

function reloadStoresAfterSessionChange(): void {
  reloadAllStores();
}

function msToDatetimeLocal(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDatetimeLocal(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseMinutesInput(value: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(0, parsed));
}

function buildArrivalPreview(
  graceMinutes: number,
  lateMinutesWeight: number,
  penaltyEnabled: boolean
): string {
  if (!penaltyEnabled) {
    return 'Late arrival penalty is off — check-in time does not affect Find Match priority.';
  }
  const exampleCheckInOffset = graceMinutes + 10;
  const lateMinutes = computeLateMinutesForCheckIn(exampleCheckInOffset, graceMinutes);
  const penaltyScore = lateMinutes * lateMinutesWeight;
  return (
    `Example: a player checks in ${exampleCheckInOffset} min after session start with ` +
    `${graceMinutes} min grace → ${lateMinutes} min late → +${penaltyScore} penalty score in Find Match.`
  );
}

export function renderSettingsScreen(container: HTMLElement): void {
  const session = useSessionStore.getState().session;
  const snapshot = useSessionStore.getState().loadSnapshot();
  const settings = snapshot?.settings;

  const header = el('div', { className: 'section-header' });
  header.append(el('div', { className: 'section-title' }, ['Settings']));
  container.append(
    header,
    el('p', { className: 'screen-lead' }, [
      'Session timing, roster transfer, voice announcements, and app info.',
    ])
  );

  const settingsUi = useSettingsUiStore.getState();

  const orgInput = el('input', {
    type: 'text',
    value: session?.organizerName ?? '',
    'aria-label': 'Organizer name',
    className: 'settings-input',
  }) as HTMLInputElement;
  const orgSave = el('button', { type: 'button', className: 'btn' }, ['Save name']);
  orgInput.addEventListener('input', () => {
    if (orgInput.value.trim().length === 0) {
      orgSave.setAttribute('disabled', 'true');
    } else {
      orgSave.removeAttribute('disabled');
    }
  });
  if (orgInput.value.trim()) {
    orgSave.removeAttribute('disabled');
  }
  orgSave.addEventListener('click', () => {
    if (!orgInput.value.trim()) return;
    useSessionStore.getState().setOrganizerName(orgInput.value);
    appRouter.navigate('settings');
  });

  const orgSection = renderSettingsCollapsibleSection(
    [
      orgInput,
      el('p', { className: 'settings-help' }, [
        'Shown on your live wallboard and in admin reports. Required.',
      ]),
      orgSave,
    ],
    {
      title: 'Organizer',
      open: settingsUi.organizerSectionOpen,
      onToggle: (open) => useSettingsUiStore.getState().setOrganizerSectionOpen(open),
    }
  );

  const gameModeSection = renderGameModeSettingsSection();

  const startField = el('div', { className: 'player-form__field' });
  startField.append(el('label', { className: 'player-form__label', for: 'session-start-time' }, [
    'Session start time',
  ]));
  const startInput = el('input', {
    id: 'session-start-time',
    type: 'datetime-local',
    className: 'settings-input',
    'aria-label': 'Session start time',
  }) as HTMLInputElement;
  if (settings?.sessionStartTime != null) {
    startInput.value = msToDatetimeLocal(settings.sessionStartTime);
  }
  startField.append(startInput);

  const arrivalPenaltyHeading = el('h4', { className: 'players-section-label' }, [
    'Find Match — late arrival penalty',
  ]);

  const graceField = el('div', { className: 'player-form__field' });
  graceField.append(
    el('label', { className: 'player-form__label', for: 'arrival-grace-minutes' }, [
      'Grace period (minutes)',
    ]),
    el('p', { className: 'screen-lead' }, [
      'Check-ins within this many minutes after session start are not counted as late.',
    ])
  );
  const graceInput = el('input', {
    id: 'arrival-grace-minutes',
    type: 'number',
    min: '0',
    max: '120',
    step: '1',
    className: 'settings-input',
    value: String(settings?.arrivalGraceMinutes ?? MATCHMAKING_FAIRNESS.defaultGraceMinutes),
    'aria-label': 'Grace period in minutes before late penalty',
  }) as HTMLInputElement;
  graceField.append(graceInput);

  const weightField = el('div', { className: 'player-form__field' });
  weightField.append(
    el('label', { className: 'player-form__label', for: 'late-minutes-weight' }, [
      'Late penalty weight (per minute)',
    ]),
    el('p', { className: 'screen-lead' }, [
      'Higher values deprioritize late check-ins more strongly in Find Match sorting.',
    ])
  );
  const weightInput = el('input', {
    id: 'late-minutes-weight',
    type: 'number',
    min: '1',
    max: '100',
    step: '1',
    className: 'settings-input',
    value: String(settings?.lateMinutesWeight ?? MATCHMAKING_FAIRNESS.lateMinutesWeight),
    'aria-label': 'Late penalty weight per minute',
  }) as HTMLInputElement;
  weightField.append(weightInput);

  const penaltyToggle = el('label', {
    className: 'settings-switch',
    for: 'arrival-penalty-enabled',
  });
  const penaltyCheckbox = el('input', {
    id: 'arrival-penalty-enabled',
    type: 'checkbox',
    className: 'settings-switch__input',
    role: 'switch',
    'aria-checked': 'false',
    'aria-label': 'Penalize late arrivals in Find Match',
  }) as HTMLInputElement;
  penaltyCheckbox.checked =
    settings?.arrivalPenaltyEnabled ?? MATCHMAKING_FAIRNESS.defaultArrivalPenaltyEnabled;
  penaltyCheckbox.setAttribute('aria-checked', penaltyCheckbox.checked ? 'true' : 'false');
  const syncPenaltyAria = (): void => {
    penaltyCheckbox.setAttribute('aria-checked', penaltyCheckbox.checked ? 'true' : 'false');
  };
  penaltyToggle.append(
    penaltyCheckbox,
    el('span', { className: 'settings-switch__track', 'aria-hidden': 'true' }, [
      el('span', { className: 'settings-switch__thumb' }),
    ]),
    el('span', { className: 'settings-switch__label' }, ['Penalize late arrivals in Find Match'])
  );

  const penaltyPreview = el('p', { className: 'screen-lead settings-preview' });
  const updatePreview = (): void => {
    syncPenaltyAria();
    penaltyPreview.textContent = buildArrivalPreview(
      parseMinutesInput(graceInput.value, MATCHMAKING_FAIRNESS.defaultGraceMinutes, 120),
      parseMinutesInput(weightInput.value, MATCHMAKING_FAIRNESS.lateMinutesWeight, 100),
      penaltyCheckbox.checked
    );
  };
  updatePreview();
  for (const input of [graceInput, weightInput]) {
    input.addEventListener('input', updatePreview);
  }
  penaltyCheckbox.addEventListener('change', updatePreview);

  const waitAlertsHeading = el('h4', { className: 'players-section-label' }, [
    'Available players — wait alerts',
  ]);

  const warnField = el('div', { className: 'player-form__field' });
  warnField.append(
    el('label', { className: 'player-form__label', for: 'available-wait-warn' }, [
      'Orange alert after (minutes waiting)',
    ])
  );
  const warnInput = el('input', {
    id: 'available-wait-warn',
    type: 'number',
    min: '1',
    max: '180',
    step: '1',
    className: 'settings-input',
    value: String(
      settings?.availableWaitWarnMinutes ?? MATCHMAKING_FAIRNESS.defaultAvailableWaitWarnMinutes
    ),
  }) as HTMLInputElement;
  warnField.append(warnInput);

  const criticalField = el('div', { className: 'player-form__field' });
  criticalField.append(
    el('label', { className: 'player-form__label', for: 'available-wait-critical' }, [
      'Red alert after (minutes waiting)',
    ])
  );
  const criticalInput = el('input', {
    id: 'available-wait-critical',
    type: 'number',
    min: '1',
    max: '240',
    step: '1',
    className: 'settings-input',
    value: String(
      settings?.availableWaitCriticalMinutes ?? MATCHMAKING_FAIRNESS.defaultAvailableWaitCriticalMinutes
    ),
  }) as HTMLInputElement;
  criticalField.append(criticalInput);

  const saveSessionBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, [
    'Save session settings',
  ]);
  saveSessionBtn.addEventListener('click', () => {
    useSessionStore.getState().updateSessionSettings({
      sessionStartTime: parseDatetimeLocal(startInput.value),
      arrivalGraceMinutes: parseMinutesInput(
        graceInput.value,
        MATCHMAKING_FAIRNESS.defaultGraceMinutes,
        120
      ),
      lateMinutesWeight: parseMinutesInput(
        weightInput.value,
        MATCHMAKING_FAIRNESS.lateMinutesWeight,
        100
      ),
      arrivalPenaltyEnabled: penaltyCheckbox.checked,
      availableWaitWarnMinutes: parseMinutesInput(
        warnInput.value,
        MATCHMAKING_FAIRNESS.defaultAvailableWaitWarnMinutes,
        180
      ),
      availableWaitCriticalMinutes: parseMinutesInput(
        criticalInput.value,
        MATCHMAKING_FAIRNESS.defaultAvailableWaitCriticalMinutes,
        240
      ),
    });
    appRouter.navigate('settings');
  });

  const startNowBtn = el('button', { type: 'button', className: 'btn' }, ['Set start time to now']);
  startNowBtn.addEventListener('click', () => {
    const now = Date.now();
    startInput.value = msToDatetimeLocal(now);
    useSessionStore.getState().updateSessionSettings({ sessionStartTime: now });
    appRouter.navigate('settings');
  });

  const archiveCount = snapshot?.sessionArchives?.length ?? 0;
  const archiveHint = el('p', { className: 'screen-lead settings-preview' }, [
    archiveCount > 0
      ? `${archiveCount} past session${archiveCount === 1 ? '' : 's'} archived. Career totals are kept on each player.`
      : 'End or start a new session to archive results for recurring club nights.',
  ]);

  const endSessionBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, [
    'End session & archive',
  ]);
  endSessionBtn.addEventListener('click', () => {
    const current = useSessionStore.getState().loadSnapshot();
    if (!current || !hasSessionActivity(current)) {
      alert('Nothing to archive yet — play at least one match or add queue activity first.');
      return;
    }
    const defaultName = defaultArchiveName();
    const name = window.prompt('Archive name for this session:', defaultName);
    if (name === null) return;

    const gameMode = getGameMode(current.settings);
    const rotationMode = isWinLoseStackMode(gameMode) || isLadderWaterfallMode(gameMode);
    const queueState = useQueueStore.getState().queueState;
    const autoRotationOn = isAutoRotationEnabled(queueState);
    const activeCount = queueState.activeMatches.length;

    let rotationNote = '';
    if (rotationMode) {
      if (autoRotationOn) {
        rotationNote =
          '• Turn off Auto-rotation on the Queue tab first so no new games start while you wrap up.\n';
      }
      if (activeCount > 0) {
        rotationNote +=
          `• ${activeCount} active match${activeCount === 1 ? '' : 'es'} will be cleared — only completed games are archived.\n`;
      }
    }

    const confirmed = window.confirm(
      `End session and save "${name.trim() || defaultName}"?\n\n` +
        '• Archives session stats for all players\n' +
        '• Clears queue, courts, and session win/loss counts\n' +
        '• Career totals are preserved\n' +
        rotationNote +
        '\nSession start time is not changed.'
    );
    if (!confirmed) return;
    endSessionAndArchive(name);
    reloadStoresAfterSessionChange();
    appRouter.navigate('settings');
  });

  const startNewSessionBtn = el('button', {
    type: 'button',
    className: 'btn btn-danger',
  }, ['Start new session']);
  startNewSessionBtn.addEventListener('click', () => {
    const current = useSessionStore.getState().loadSnapshot();
    const shouldOfferArchive = current != null && hasSessionActivity(current);
    let archiveName: string | undefined;

    if (shouldOfferArchive) {
      const defaultName = defaultArchiveName();
      const name = window.prompt(
        'Archive current session before starting new? Leave blank to skip archiving.',
        defaultName
      );
      if (name === null) return;
      archiveName = name.trim() || undefined;
    }

    const confirmed = window.confirm(
      'Start a new session?\n\n' +
        (archiveName ? `• Archives current session as "${archiveName}"\n` : '') +
        '• Clears the match queue and active courts\n' +
        '• Resets session win/loss/game counts for all players\n' +
        '• Sets session start time to now\n\n' +
        'Your player roster and career stats are kept.'
    );
    if (!confirmed) return;
    startNewSession({ archiveName, archiveCurrent: false });
    reloadStoresAfterSessionChange();
    appRouter.navigate('queue');
  });

  const sessionActions = el('div', { className: 'action-row' });
  sessionActions.append(startNowBtn, saveSessionBtn, endSessionBtn, startNewSessionBtn);

  const sessionSection = renderSettingsCollapsibleSection(
    [
      el('p', { className: 'screen-lead' }, [
        'Configure session timing, arrival penalties for Find Match, and available-player wait alerts.',
      ]),
      startField,
      arrivalPenaltyHeading,
      graceField,
      weightField,
      penaltyToggle,
      penaltyPreview,
      waitAlertsHeading,
      warnField,
      criticalField,
      archiveHint,
      sessionActions,
    ],
    {
      title: 'Session',
      open: settingsUi.sessionSectionOpen,
      onToggle: (open) => useSettingsUiStore.getState().setSessionSectionOpen(open),
    }
  );

  const playerCount = snapshot?.players.length ?? 0;
  const courtCount = snapshot?.settings?.courtCount ?? snapshot?.courts.length ?? 0;

  const rosterExportBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, [
    'Export roster JSON',
  ]);
  rosterExportBtn.addEventListener('click', () => {
    const data = useSessionStore.getState().loadSnapshot();
    if (!data) {
      alert('Nothing to export.');
      return;
    }
    downloadJson(defaultRosterExportFilename(), serializeRosterExport(data));
  });

  const rosterImportLabel = el('label', { className: 'btn btn-secondary file-label' }, [
    'Import roster JSON',
  ]);
  const rosterImportInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    className: 'file-input-hidden',
  }) as HTMLInputElement;

  rosterImportInput.addEventListener('change', async () => {
    const file = rosterImportInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = parseRosterImportJson(text);
      const confirmed = window.confirm(
        `Import roster from file?\n\n` +
          `• ${payload.players.length} player${payload.players.length === 1 ? '' : 's'}\n` +
          `• ${payload.courtCount} court${payload.courtCount === 1 ? '' : 's'}\n\n` +
          'This replaces your current player list and court setup. Queue and active matches are kept.'
      );
      if (!confirmed) return;
      useSessionStore.getState().importRoster(payload);
      reloadStoresAfterSessionChange();
      appRouter.navigate('players');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Import failed');
    } finally {
      rosterImportInput.value = '';
    }
  });

  rosterImportLabel.append(rosterImportInput);

  const testRosterHeading = el('h4', { className: 'players-section-label' }, [
    'Matchmaking test roster',
  ]);
  const testRosterCountSelect = el('select', {
    id: 'test-roster-count',
    className: 'settings-input test-roster-count__select',
    'aria-label': 'Number of test players to load',
  }) as HTMLSelectElement;
  for (const count of TEST_ROSTER_COUNT_OPTIONS) {
    const option = el('option', { value: String(count) }, [
      `${count} players`,
    ]) as HTMLOptionElement;
    if (count === TEST_ROSTER_SIZE) option.selected = true;
    testRosterCountSelect.append(option);
  }

  const loadTestRosterBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, [
    'Load test players',
  ]);
  loadTestRosterBtn.addEventListener('click', () => {
    const count = Number(testRosterCountSelect.value);
    const confirmed = window.confirm(
      `Add ${count} dummy players for matchmaking tests?\n\n` +
        '• Realistic names with a balanced male/female mix\n' +
        '• DUPR spread: ~2.0 beginner through ~5.2 expert\n' +
        '• All checked in and ready to queue\n\n' +
        'Existing players are kept. Names already in use are skipped.'
    );
    if (!confirmed) return;
    const { added, skipped } = usePlayerStore
      .getState()
      .loadTestRoster({ checkIn: true, count });
    reloadStoresAfterSessionChange();
    alert(
      `Added ${added} test player${added === 1 ? '' : 's'}` +
        (skipped > 0 ? ` (${skipped} skipped — name already exists).` : '.') +
        '\n\nOpen the Queue tab and try Create Match.'
    );
    appRouter.navigate('queue');
  });

  const testRosterActions = el('div', { className: 'action-row test-roster-count' });
  testRosterActions.append(testRosterCountSelect, loadTestRosterBtn);

  const rosterActions = el('div', { className: 'action-row action-row--equal' });
  rosterActions.append(rosterExportBtn, rosterImportLabel);

  const fullSessionHeading = el('h4', { className: 'players-section-label' }, [
    'Full session backup (advanced)',
  ]);

  const exportBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, [
    'Export full session JSON',
  ]);
  exportBtn.addEventListener('click', () => {
    const data = useSessionStore.getState().loadSnapshot();
    if (!data) {
      alert('Nothing to export.');
      return;
    }
    const ui = useQueueUiStore.getState();
    const dataForExport = {
      ...data,
      settings: mergeAppSettings(data.settings, data.session.organizerName, {
        courtFormat: ui.courtFormat,
        matchMode: ui.matchMode,
      }),
    };
    downloadJson(defaultExportFilename(), serializeExport(dataForExport));
  });

  const importLabel = el('label', { className: 'btn btn-secondary file-label' }, [
    'Import full session JSON',
  ]);
  const importInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    className: 'file-input-hidden',
  }) as HTMLInputElement;

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = parseImportJson(text);
      if (!window.confirm('Replace current session with imported data?')) return;
      useSessionStore.getState().importSnapshot(data);
      reloadStoresAfterSessionChange();
      appRouter.navigate('players');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Import failed');
    } finally {
      importInput.value = '';
    }
  });

  importLabel.append(importInput);
  const fullSessionActions = el('div', { className: 'action-row action-row--equal' });
  fullSessionActions.append(exportBtn, importLabel);

  const transferSection = renderSettingsCollapsibleSection(
    [
      el('p', { className: 'screen-lead' }, [
        'Export player names, gender, DUPR ratings, and court setup as JSON. Import the file on another device to copy the same roster without moving the queue or active matches.',
      ]),
      el('p', { className: 'screen-lead settings-preview' }, [
        `Current: ${playerCount} player${playerCount === 1 ? '' : 's'}, ${courtCount} court${courtCount === 1 ? '' : 's'}.`,
      ]),
      testRosterHeading,
      el('p', { className: 'screen-lead' }, [
        'Load checked-in test players with realistic names and varied DUPR ratings to stress-test matchmaking. Choose 8, 16, 24, 32, or 50 players.',
      ]),
      testRosterActions,
      rosterActions,
      fullSessionHeading,
      el('p', { className: 'screen-lead' }, [
        'Includes queue, active matches, session timing, and all settings (game mode, Find Match penalties, court format, and more). Use when moving an in-progress session between devices.',
      ]),
      fullSessionActions,
    ],
    {
      title: 'Roster & courts transfer',
      open: settingsUi.transferSectionOpen,
      onToggle: (open) => useSettingsUiStore.getState().setTransferSectionOpen(open),
    }
  );

  container.append(
    renderAccountSettingsPanel(),
    orgSection,
    gameModeSection,
    sessionSection,
    renderTtsSettingsPanel(),
    transferSection,
    renderDataManagementPanel(),
    renderAppInformationPanel()
  );

  const sponsorPanel = renderSponsorSettingsPanel();
  if (sponsorPanel) {
    container.insertBefore(sponsorPanel, container.children[1] ?? null);
  }
}
