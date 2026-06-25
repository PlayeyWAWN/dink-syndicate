import { MATCHMAKING_FAIRNESS } from '@/config/matchmaking';
import { fairnessRanker } from '@/modules/matchmaking/FairnessRanker';
import { AppSettings } from '@/types/app-data';
import { Player } from '@/types/player';

/** Minutes after session start before a check-in is "very late". */
export const VERY_LATE_THRESHOLD_MINUTES = 30;

export type ArrivalTier =
  | 'early'
  | 'onTime'
  | 'grace'
  | 'late'
  | 'veryLate'
  | 'notCheckedIn';

export interface ArrivalTierSummary {
  count: number;
  avgPenaltyScore: number | null;
  avgOffsetMinutes: number | null;
}

export interface ArrivalAnalyticsResult {
  configured: boolean;
  sessionStartTime?: number;
  graceMinutes: number;
  veryLateThresholdMinutes: number;
  penaltyEnabled: boolean;
  lateMinutesWeight: number;
  summaries: Record<ArrivalTier, ArrivalTierSummary>;
  playersByTier: Record<ArrivalTier, Player[]>;
}

const EMPTY_TIERS = (): Record<ArrivalTier, Player[]> => ({
  early: [],
  onTime: [],
  grace: [],
  late: [],
  veryLate: [],
  notCheckedIn: [],
});

function checkInTimestamp(player: Player): number | undefined {
  return player.checkedInAt ?? player.availableSince;
}

export function determineArrivalTier(
  checkInMs: number,
  sessionStartMs: number,
  graceMinutes: number,
  veryLateMinutes = VERY_LATE_THRESHOLD_MINUTES
): Exclude<ArrivalTier, 'notCheckedIn'> {
  const minutesLate = (checkInMs - sessionStartMs) / 60_000;
  if (minutesLate < 0) return 'early';
  if (minutesLate <= 0) return 'onTime';
  if (minutesLate <= graceMinutes) return 'grace';
  if (minutesLate <= veryLateMinutes) return 'late';
  return 'veryLate';
}

function buildContext(settings?: AppSettings) {
  return fairnessRanker.createContext({
    sessionStartTime: settings?.sessionStartTime,
    arrivalGraceMinutes:
      settings?.arrivalGraceMinutes ?? MATCHMAKING_FAIRNESS.defaultGraceMinutes,
    arrivalPenaltyEnabled:
      settings?.arrivalPenaltyEnabled ?? MATCHMAKING_FAIRNESS.defaultArrivalPenaltyEnabled,
    lateMinutesWeight:
      settings?.lateMinutesWeight ?? MATCHMAKING_FAIRNESS.lateMinutesWeight,
  });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Session check-in tiers relative to configured session start time. */
export function computeArrivalAnalytics(
  players: Player[],
  settings?: AppSettings
): ArrivalAnalyticsResult {
  const graceMinutes =
    settings?.arrivalGraceMinutes ?? MATCHMAKING_FAIRNESS.defaultGraceMinutes;
  const veryLateThresholdMinutes = VERY_LATE_THRESHOLD_MINUTES;
  const penaltyEnabled =
    settings?.arrivalPenaltyEnabled ?? MATCHMAKING_FAIRNESS.defaultArrivalPenaltyEnabled;
  const lateMinutesWeight =
    settings?.lateMinutesWeight ?? MATCHMAKING_FAIRNESS.lateMinutesWeight;
  const sessionStartTime = settings?.sessionStartTime;
  const playersByTier = EMPTY_TIERS();

  if (sessionStartTime == null) {
    return {
      configured: false,
      graceMinutes,
      veryLateThresholdMinutes,
      penaltyEnabled,
      lateMinutesWeight,
      summaries: {
        early: { count: 0, avgPenaltyScore: null, avgOffsetMinutes: null },
        onTime: { count: 0, avgPenaltyScore: null, avgOffsetMinutes: null },
        grace: { count: 0, avgPenaltyScore: null, avgOffsetMinutes: null },
        late: { count: 0, avgPenaltyScore: null, avgOffsetMinutes: null },
        veryLate: { count: 0, avgPenaltyScore: null, avgOffsetMinutes: null },
        notCheckedIn: { count: 0, avgPenaltyScore: null, avgOffsetMinutes: null },
      },
      playersByTier,
    };
  }

  const context = buildContext(settings);
  const roster = players.filter((player) => !player.excluded);
  const offsetByTier: Record<ArrivalTier, number[]> = {
    early: [],
    onTime: [],
    grace: [],
    late: [],
    veryLate: [],
    notCheckedIn: [],
  };
  const penaltyByTier: Record<ArrivalTier, number[]> = {
    early: [],
    onTime: [],
    grace: [],
    late: [],
    veryLate: [],
    notCheckedIn: [],
  };

  for (const player of roster) {
    const checkInMs = checkInTimestamp(player);
    if (!player.checkedIn || checkInMs == null) {
      playersByTier.notCheckedIn.push(player);
      continue;
    }

    const tier = determineArrivalTier(
      checkInMs,
      sessionStartTime,
      graceMinutes,
      veryLateThresholdMinutes
    );
    playersByTier[tier].push(player);

    const offsetMinutes = (checkInMs - sessionStartTime) / 60_000;
    offsetByTier[tier].push(offsetMinutes);

    const lateMinutes = fairnessRanker.lateMinutes(player, context);
    penaltyByTier[tier].push(lateMinutes * context.lateMinutesWeight);
  }

  const summaries = {} as Record<ArrivalTier, ArrivalTierSummary>;
  for (const tier of Object.keys(playersByTier) as ArrivalTier[]) {
    summaries[tier] = {
      count: playersByTier[tier].length,
      avgPenaltyScore: average(penaltyByTier[tier]),
      avgOffsetMinutes: average(offsetByTier[tier]),
    };
  }

  return {
    configured: true,
    sessionStartTime,
    graceMinutes,
    veryLateThresholdMinutes,
    penaltyEnabled,
    lateMinutesWeight,
    summaries,
    playersByTier,
  };
}

export function formatArrivalPenaltyScore(value: number | null): string {
  if (value == null) return '—';
  return value.toFixed(2);
}

export function formatSessionStartTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
