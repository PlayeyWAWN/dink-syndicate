import { APP_DATA_VERSION, migrateAppData } from '@/types/app-data';
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
});

describe('SessionTransferService', () => {
  it('builds export envelope', () => {
    const envelope = buildExportEnvelope(sampleData);
    expect(envelope.format).toBe(SESSION_TRANSFER_FORMAT);
    expect(envelope.version).toBe(1);
    expect(envelope.data.players).toEqual([]);
  });

  it('round-trips serialize and parse', () => {
    const json = serializeExport(sampleData);
    const parsed = parseImportJson(json);
    expect(parsed.players).toEqual([]);
  });

  it('rejects wrong format', () => {
    expect(() =>
      parseImportJson(JSON.stringify({ format: 'other', version: 1, data: {} }))
    ).toThrow(/Dink Syndicate/);
  });
});
