import { APP_DATA_VERSION, migrateAppData } from '@/types/app-data';
import { createPlayer } from '@/types/player';
import { SessionSchema } from '@/types/session';
import {
  buildRosterExportEnvelope,
  buildRosterPayload,
  courtsFromRosterPayload,
  parseRosterImportJson,
  ROSTER_TRANSFER_FORMAT,
  rosterPlayerToPlayer,
  serializeRosterExport,
} from '@/modules/session/RosterTransferService';
import {
  serializeExport,
  SESSION_TRANSFER_FORMAT,
} from '@/modules/session/SessionTransferService';

const sampleData = migrateAppData({
  version: 1,
  session: SessionSchema.parse({
    id: 'test-session',
    organizerName: 'Host',
    role: 'queue_master',
    createdAt: Date.now(),
  }),
  players: [
    createPlayer({ id: 'p1', name: 'Alice', gender: 'female', duprDoublesRating: 3.5 }),
    createPlayer({ id: 'p2', name: 'Bob', duprDoublesRating: 4.0 }),
  ],
  courts: [
    { id: 'court-1', label: '1', activeMatchId: null },
    { id: 'court-2', label: '2', activeMatchId: null },
    { id: 'court-3', label: 'Center', activeMatchId: 'match-1' },
  ],
  queueState: { queue: [], activeMatches: [], completedMatches: [] },
  settings: {
    courtCount: 3,
    organizerName: 'Host',
  },
});

describe('RosterTransferService', () => {
  it('builds roster export envelope with players and court count', () => {
    const envelope = buildRosterExportEnvelope(sampleData);
    expect(envelope.format).toBe(ROSTER_TRANSFER_FORMAT);
    expect(envelope.data.players).toHaveLength(2);
    expect(envelope.data.players[0]?.name).toBe('Alice');
    expect(envelope.data.courtCount).toBe(3);
    expect(envelope.data.courts).toHaveLength(3);
    expect(envelope.data.courts[2]?.label).toBe('Center');
  });

  it('strips session-only player fields on export', () => {
    const payload = buildRosterPayload(sampleData);
    expect(payload.players[0]).not.toHaveProperty('gamesPlayed');
    expect(payload.players[0]).not.toHaveProperty('checkedIn');
  });

  it('round-trips serialize and parse', () => {
    const json = serializeRosterExport(sampleData);
    const parsed = parseRosterImportJson(json);
    expect(parsed.players).toHaveLength(2);
    expect(parsed.courtCount).toBe(3);
  });

  it('imports roster players with fresh session stats', () => {
    const payload = buildRosterPayload(sampleData);
    const player = rosterPlayerToPlayer(payload.players[0]!);
    expect(player.gamesPlayed).toBe(0);
    expect(player.checkedIn).toBe(false);
    expect(player.name).toBe('Alice');
  });

  it('rebuilds courts without active matches', () => {
    const payload = buildRosterPayload(sampleData);
    const courts = courtsFromRosterPayload(payload);
    expect(courts).toHaveLength(3);
    expect(courts.every((court) => court.activeMatchId === null)).toBe(true);
    expect(courts[2]?.label).toBe('Center');
  });

  it('accepts full session export files for roster import', () => {
    const sessionJson = serializeExport(sampleData);
    const parsed = parseRosterImportJson(sessionJson);
    expect(parsed.players).toHaveLength(2);
    expect(parsed.courtCount).toBe(3);
  });

  it('rejects unknown format', () => {
    expect(() =>
      parseRosterImportJson(JSON.stringify({ format: 'other', version: 1, data: {} }))
    ).toThrow(/Dink Syndicate/);
  });

  it('full session envelope format is recognized separately', () => {
    const json = serializeExport(sampleData);
    const raw = JSON.parse(json) as { format: string };
    expect(raw.format).toBe(SESSION_TRANSFER_FORMAT);
  });
});
