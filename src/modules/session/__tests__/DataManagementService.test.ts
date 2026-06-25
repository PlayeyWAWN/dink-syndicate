import {
  buildWipeConfirmationMessage,
  confirmWipeWithTypedPhrase,
  summarizeDataForWipe,
  WIPE_CONFIRMATION_PHRASE,
  wipeAllAppData,
} from '@/modules/session/DataManagementService';
import { useSessionStore } from '@/stores/sessionStore';
import { AppData } from '@/types/app-data';

function snapshot(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 2,
    session: {
      id: 'sess-1',
      organizerName: 'Host',
      role: 'queue_master',
      createdAt: Date.now(),
    },
    players: [{ id: 'p1' } as AppData['players'][0]],
    courts: [],
    queueState: {
      queue: [{ id: 'q1' } as AppData['queueState']['queue'][0]],
      activeMatches: [{ id: 'm1' } as AppData['queueState']['activeMatches'][0]],
      completedMatches: [{ id: 'm2' } as AppData['queueState']['completedMatches'][0]],
    },
    settings: { courtCount: 4, organizerName: 'Host' },
    sessionArchives: [{ id: 'a1' } as AppData['sessionArchives'][0]],
    ...overrides,
  };
}

describe('DataManagementService', () => {
  it('summarizes wipe impact counts', () => {
    const summary = summarizeDataForWipe(snapshot());
    expect(summary.playerCount).toBe(1);
    expect(summary.queuedMatches).toBe(1);
    expect(summary.activeMatches).toBe(1);
    expect(summary.completedMatches).toBe(1);
    expect(summary.archiveCount).toBe(1);
  });

  it('builds a confirmation message listing permanent deletion', () => {
    const message = buildWipeConfirmationMessage(summarizeDataForWipe(snapshot()));
    expect(message).toContain('cannot be undone');
    expect(message).toContain('career stats');
    expect(message).toContain('Export full session JSON');
  });

  it('requires typing DELETE to confirm wipe', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('DELETE');

    expect(confirmWipeWithTypedPhrase(summarizeDataForWipe(snapshot()))).toBe(true);
    expect(promptSpy).toHaveBeenCalledWith(
      expect.stringContaining(WIPE_CONFIRMATION_PHRASE),
      ''
    );

    confirmSpy.mockRestore();
    promptSpy.mockRestore();
  });

  it('rejects wipe when typed phrase does not match', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'prompt').mockReturnValue('REMOVE');

    expect(confirmWipeWithTypedPhrase(summarizeDataForWipe(snapshot()))).toBe(false);
  });

  it('wipes persisted data through session store', () => {
    useSessionStore.setState({
      session: snapshot().session,
      hydrated: true,
    });
    jest.spyOn(useSessionStore.getState(), 'wipeAllData').mockReturnValue(true);

    expect(wipeAllAppData()).toBe(true);
  });
});
