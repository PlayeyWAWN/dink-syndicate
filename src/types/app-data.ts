import { z } from 'zod';
import { PlayerSchema, PlayerStats } from '@/types/player';
import { CourtSchema } from '@/types/court';
import { QueueStateSchema } from '@/types/queue';
import { SessionSchema } from '@/types/session';
import { SessionArchiveSchema } from '@/types/session-archive';
import { MATCHMAKING_FAIRNESS } from '@/config/matchmaking';

export const APP_DATA_VERSION = 2;

export const AppSettingsSchema = z.object({
  courtCount: z.number().int().min(0).max(24).default(4),
  organizerName: z.string().min(1),
  /** Unix ms — today's session start for arrival penalty. */
  sessionStartTime: z.number().int().nonnegative().optional(),
  /** Minutes after session start before late penalty applies. */
  arrivalGraceMinutes: z
    .number()
    .int()
    .min(0)
    .max(120)
    .default(MATCHMAKING_FAIRNESS.defaultGraceMinutes)
    .optional(),
  /** When false, late arrivals are not deprioritized in Find Match. */
  arrivalPenaltyEnabled: z
    .boolean()
    .default(MATCHMAKING_FAIRNESS.defaultArrivalPenaltyEnabled)
    .optional(),
  /** Sorting penalty added per minute late in Find Match (after grace). */
  lateMinutesWeight: z.number().int().min(1).max(100).default(MATCHMAKING_FAIRNESS.lateMinutesWeight).optional(),
  /** Available pool: orange alert after this many minutes waiting. */
  availableWaitWarnMinutes: z
    .number()
    .int()
    .min(1)
    .max(180)
    .default(MATCHMAKING_FAIRNESS.defaultAvailableWaitWarnMinutes)
    .optional(),
  /** Available pool: red alert after this many minutes waiting. */
  availableWaitCriticalMinutes: z
    .number()
    .int()
    .min(1)
    .max(240)
    .default(MATCHMAKING_FAIRNESS.defaultAvailableWaitCriticalMinutes)
    .optional(),
  /** speechSynthesis voiceURI for queue announcements. */
  ttsVoiceUri: z.string().optional(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

/** Persisted app snapshot stored in scoped localStorage. */
export const AppDataSchema = z.object({
  version: z.number().int().default(APP_DATA_VERSION),
  session: SessionSchema,
  players: z.array(PlayerSchema).default([]),
  courts: z.array(CourtSchema).default([]),
  queueState: QueueStateSchema.default({ queue: [], activeMatches: [], completedMatches: [] }),
  settings: AppSettingsSchema.optional(),
  sessionArchives: z.array(SessionArchiveSchema).default([]),
});

export type AppData = z.infer<typeof AppDataSchema>;

function migratePlayerRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const gamesPlayed = typeof raw.gamesPlayed === 'number' ? raw.gamesPlayed : 0;
  const wins = typeof raw.wins === 'number' ? raw.wins : 0;
  const losses = typeof raw.losses === 'number' ? raw.losses : 0;
  const career = raw.career as PlayerStats | undefined;

  return {
    ...raw,
    career: career ?? { gamesPlayed, wins, losses },
  };
}

/** Upgrade legacy snapshots before validation — preserves stats in career + session fields. */
export function migrateAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid app data');
  }

  const record = raw as Record<string, unknown>;
  const version = typeof record.version === 'number' ? record.version : 1;
  let next: Record<string, unknown> = { ...record };

  if (version < APP_DATA_VERSION) {
    const players = Array.isArray(record.players)
      ? (record.players as Record<string, unknown>[]).map(migratePlayerRecord)
      : [];

    next = {
      ...next,
      version: APP_DATA_VERSION,
      players,
      sessionArchives: record.sessionArchives ?? [],
    };
  }

  return AppDataSchema.parse(next);
}

export function mergeAppSettings(
  current: AppSettings | undefined,
  sessionOrganizerName: string,
  partial?: Partial<AppSettings>
): AppSettings {
  return {
    courtCount: partial?.courtCount ?? current?.courtCount ?? 4,
    organizerName: partial?.organizerName ?? current?.organizerName ?? sessionOrganizerName,
    sessionStartTime: partial?.sessionStartTime ?? current?.sessionStartTime,
    arrivalGraceMinutes:
      partial?.arrivalGraceMinutes ??
      current?.arrivalGraceMinutes ??
      MATCHMAKING_FAIRNESS.defaultGraceMinutes,
    arrivalPenaltyEnabled:
      partial?.arrivalPenaltyEnabled ??
      current?.arrivalPenaltyEnabled ??
      MATCHMAKING_FAIRNESS.defaultArrivalPenaltyEnabled,
    lateMinutesWeight:
      partial?.lateMinutesWeight ??
      current?.lateMinutesWeight ??
      MATCHMAKING_FAIRNESS.lateMinutesWeight,
    availableWaitWarnMinutes:
      partial?.availableWaitWarnMinutes ??
      current?.availableWaitWarnMinutes ??
      MATCHMAKING_FAIRNESS.defaultAvailableWaitWarnMinutes,
    availableWaitCriticalMinutes:
      partial?.availableWaitCriticalMinutes ??
      current?.availableWaitCriticalMinutes ??
      MATCHMAKING_FAIRNESS.defaultAvailableWaitCriticalMinutes,
    ttsVoiceUri: partial?.ttsVoiceUri ?? current?.ttsVoiceUri,
  };
}

export function toSessionSettings(settings?: AppSettings) {
  return {
    sessionStartTime: settings?.sessionStartTime,
    arrivalGraceMinutes: settings?.arrivalGraceMinutes,
    arrivalPenaltyEnabled: settings?.arrivalPenaltyEnabled,
    lateMinutesWeight: settings?.lateMinutesWeight,
  };
}
