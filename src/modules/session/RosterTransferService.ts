import { DEFAULT_COURT_COUNT } from '@/config/constants';
import { courtService } from '@/modules/courts/CourtService';
import {
  SESSION_TRANSFER_FORMAT,
  SESSION_TRANSFER_VERSION,
  MAX_IMPORT_BYTES,
} from '@/modules/session/SessionTransferService';
import { AppData, migrateAppData } from '@/types/app-data';
import { Court, createCourt } from '@/types/court';
import {
  Player,
  PlayerDuprProfileSchema,
  PlayerGenderSchema,
  PlayerSchema,
  PlayerStatsSchema,
  EMPTY_PLAYER_STATS,
} from '@/types/player';
import { z } from 'zod';

export const ROSTER_TRANSFER_FORMAT = 'dink-syndicate-roster-transfer';
export const ROSTER_TRANSFER_VERSION = 1;

export const RosterCourtSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export type RosterCourt = z.infer<typeof RosterCourtSchema>;

export const RosterPlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  gender: PlayerGenderSchema.default('male'),
  excluded: z.boolean().default(false),
  dupr: PlayerDuprProfileSchema,
  career: PlayerStatsSchema.optional(),
});

export type RosterPlayer = z.infer<typeof RosterPlayerSchema>;

export const RosterTransferPayloadSchema = z.object({
  players: z.array(RosterPlayerSchema),
  courtCount: z.number().int().min(1).max(24),
  courts: z.array(RosterCourtSchema).default([]),
});

export type RosterTransferPayload = z.infer<typeof RosterTransferPayloadSchema>;

export interface RosterTransferEnvelope {
  format: typeof ROSTER_TRANSFER_FORMAT;
  version: number;
  exportedAt: string;
  data: RosterTransferPayload;
}

export function toRosterExportPlayer(player: Player): RosterPlayer {
  return RosterPlayerSchema.parse({
    id: player.id,
    name: player.name,
    gender: player.gender,
    excluded: player.excluded,
    dupr: player.dupr,
    career: player.career,
  });
}

export function buildRosterPayload(data: AppData): RosterTransferPayload {
  const courtCount = data.settings?.courtCount ?? data.courts.length ?? DEFAULT_COURT_COUNT;
  const courts =
    data.courts.length > 0
      ? data.courts.map(({ id, label }) => ({ id, label }))
      : Array.from({ length: courtCount }, (_, index) => ({
          id: `court-${index + 1}`,
          label: String(index + 1),
        }));

  return RosterTransferPayloadSchema.parse({
    players: data.players.map(toRosterExportPlayer),
    courtCount: Math.max(courtCount, courts.length),
    courts,
  });
}

export function buildRosterExportEnvelope(data: AppData): RosterTransferEnvelope {
  return {
    format: ROSTER_TRANSFER_FORMAT,
    version: ROSTER_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    data: buildRosterPayload(data),
  };
}

export function serializeRosterExport(data: AppData): string {
  return JSON.stringify(buildRosterExportEnvelope(data), null, 2);
}

export function rosterPlayerToPlayer(rosterPlayer: RosterPlayer): Player {
  const now = Date.now();
  return PlayerSchema.parse({
    ...rosterPlayer,
    checkedIn: false,
    checkedInAt: undefined,
    availableSince: undefined,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    career: rosterPlayer.career ?? { ...EMPTY_PLAYER_STATS },
    createdAt: now,
    updatedAt: now,
  });
}

export function courtsFromRosterPayload(payload: RosterTransferPayload): Court[] {
  const imported = payload.courts.map((court, index) => rosterCourtToCourt(court, index));
  return courtService
    .ensureCourts(imported, payload.courtCount)
    .map((court) => ({ ...court, activeMatchId: null }));
}

function rosterCourtToCourt(court: RosterCourt, index: number): Court {
  return {
    ...createCourt(index, court.label),
    id: court.id,
    activeMatchId: null,
  };
}

function parseEnvelopeRaw(json: string): unknown {
  if (json.length > MAX_IMPORT_BYTES) {
    throw new Error('Import file is too large (max 10 MB).');
  }
  return JSON.parse(json) as unknown;
}

export function parseRosterImportJson(json: string): RosterTransferPayload {
  const raw = parseEnvelopeRaw(json);

  if (raw && typeof raw === 'object' && 'format' in raw) {
    const envelope = raw as { format: string; version?: number; data?: unknown };

    if (envelope.format === ROSTER_TRANSFER_FORMAT) {
      if (envelope.version !== ROSTER_TRANSFER_VERSION) {
        throw new Error(`Unsupported roster file version: ${envelope.version}`);
      }
      return RosterTransferPayloadSchema.parse(envelope.data);
    }

    if (envelope.format === SESSION_TRANSFER_FORMAT) {
      if (envelope.version !== SESSION_TRANSFER_VERSION) {
        throw new Error(`Unsupported session file version: ${envelope.version}`);
      }
      const appData = migrateAppData(envelope.data);
      return buildRosterPayload(appData);
    }

    throw new Error('Not a Dink Syndicate roster or session file.');
  }

  return RosterTransferPayloadSchema.parse(raw);
}

export function defaultRosterExportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `dink-syndicate-roster-${date}.json`;
}
