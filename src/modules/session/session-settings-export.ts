import { COURT_FORMATS, QUEUE_MATCH_MODES } from '@/config/queue-match-modes';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import { AppSettings } from '@/types/app-data';
import { GAME_MODE_OPTIONS, GameMode } from '@/types/game-mode';
import { isAutoRotationEnabled } from '@/types/queue';
import { QueueState } from '@/types/queue';

/** Human-readable session settings included in full session JSON exports. */
export interface SessionSettingsSummary {
  organizerName: string;
  courtCount: number;
  gameMode: string;
  gameModeId: GameMode;
  courtFormat: string;
  courtFormatId: NonNullable<AppSettings['courtFormat']>;
  matchMode: string;
  matchModeId: NonNullable<AppSettings['matchMode']>;
  penalizeLateArrivalsInFindMatch: boolean;
  sessionStartTime: string | null;
  arrivalGraceMinutes: number;
  lateMinutesWeight: number;
  availableWaitWarnMinutes: number;
  availableWaitCriticalMinutes: number;
  autoRotationEnabled: boolean | null;
  ttsVoiceUri: string | null;
  synergyTeamsEnabled: boolean;
  synergyPairCount: number;
}

function labelForGameMode(mode: GameMode): string {
  return GAME_MODE_OPTIONS.find((option) => option.id === mode)?.label ?? mode;
}

function labelForCourtFormat(format: NonNullable<AppSettings['courtFormat']>): string {
  return COURT_FORMATS.find((option) => option.id === format)?.label ?? format;
}

function labelForMatchMode(mode: NonNullable<AppSettings['matchMode']>): string {
  return QUEUE_MATCH_MODES.find((option) => option.id === mode)?.label ?? mode;
}

export function buildSessionSettingsSummary(
  settings: AppSettings,
  queueState?: QueueState
): SessionSettingsSummary {
  const gameModeId = getGameMode(settings);
  const courtFormatId = settings.courtFormat ?? 'doubles';
  const matchModeId = settings.matchMode ?? 'balanced';
  const rotationMode = gameModeId === 'win_lose_stack' || gameModeId === 'ladder_waterfall';

  return {
    organizerName: settings.organizerName,
    courtCount: settings.courtCount,
    gameMode: labelForGameMode(gameModeId),
    gameModeId,
    courtFormat: labelForCourtFormat(courtFormatId),
    courtFormatId,
    matchMode: labelForMatchMode(matchModeId),
    matchModeId,
    penalizeLateArrivalsInFindMatch: settings.arrivalPenaltyEnabled ?? true,
    sessionStartTime:
      settings.sessionStartTime != null ? new Date(settings.sessionStartTime).toISOString() : null,
    arrivalGraceMinutes: settings.arrivalGraceMinutes ?? 10,
    lateMinutesWeight: settings.lateMinutesWeight ?? 10,
    availableWaitWarnMinutes: settings.availableWaitWarnMinutes ?? 10,
    availableWaitCriticalMinutes: settings.availableWaitCriticalMinutes ?? 15,
    autoRotationEnabled: rotationMode
      ? isAutoRotationEnabled(queueState)
      : null,
    ttsVoiceUri: settings.ttsVoiceUri ?? null,
    synergyTeamsEnabled: settings.synergyTeamsEnabled ?? false,
    synergyPairCount: settings.synergyPairs?.length ?? 0,
  };
}
