import { APP_DATA_VERSION, mergeAppSettings, migrateAppData } from '@/types/app-data';
import {
  buildExportEnvelope,
  parseImportJson,
  serializeExport,
  SESSION_TRANSFER_FORMAT,
} from '@/modules/session/SessionTransferService';
import { SessionSchema } from '@/types/session';

const sampleData = migrateAppData({
  version: APP_DATA_VERSION,
  session: SessionSchema.parse({
    id: 'test-session',
    organizerName: 'Host',
    role: 'queue_master',
    createdAt: Date.now(),
  }),
  players: [],
  courts: [],
  queueState: { queue: [], activeMatches: [], completedMatches: [] },
  settings: mergeAppSettings(undefined, 'Host', {
    gameMode: 'win_lose_stack',
    arrivalPenaltyEnabled: true,
    courtFormat: 'singles',
    matchMode: 'same_gender',
  }),
});

describe('SessionTransferService', () => {
  it('builds export envelope with settings summary and merged settings', () => {
    const envelope = buildExportEnvelope(sampleData);
    expect(envelope.format).toBe(SESSION_TRANSFER_FORMAT);
    expect(envelope.version).toBe(1);
    expect(envelope.data.players).toEqual([]);
    expect(envelope.settingsSummary.gameMode).toBe('Win/Lose Stack');
    expect(envelope.settingsSummary.penalizeLateArrivalsInFindMatch).toBe(true);
    expect(envelope.settingsSummary.courtFormatId).toBe('singles');
    expect(envelope.data.settings?.gameMode).toBe('win_lose_stack');
    expect(envelope.data.settings?.courtFormat).toBe('singles');
    expect(envelope.data.settings?.matchMode).toBe('same_gender');
  });

  it('round-trips serialize and parse', () => {
    const json = serializeExport(sampleData);
    const parsed = parseImportJson(json);
    expect(parsed.players).toEqual([]);
    expect(parsed.settings?.gameMode).toBe('win_lose_stack');
    expect(parsed.settings?.courtFormat).toBe('singles');
  });

  it('rejects wrong format', () => {
    expect(() =>
      parseImportJson(JSON.stringify({ format: 'other', version: 1, data: {} }))
    ).toThrow(/Dink Syndicate/);
  });
});
