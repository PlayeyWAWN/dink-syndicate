import { formatMatchDuration, formatQueueWaitDuration } from '@/lib/match-timer';
import { Court } from '@/types/court';
import { Player, isPlayerMatchable } from '@/types/player';
import { Match, QueueState } from '@/types/queue';

export interface QueueAnalyticsInput {
  queueState: QueueState;
  courts: Court[];
  players: Player[];
  sessionStartTime?: number;
  now?: number;
}

export interface QueueAnalytics {
  avgQueueWaitMs: number | null;
  avgMatchDurationMs: number | null;
  longestAvailableWaitMs: number | null;
  matchesCompletedThisSession: number;
  matchesCompletedLastHour: number;
  courtUtilizationPercent: number | null;
  currentQueueDepth: number;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function matchDurationMs(match: Match): number | null {
  if (match.startedAt == null || match.completedAt == null) return null;
  return Math.max(0, match.completedAt - match.startedAt);
}

function queueWaitMs(match: Match): number | null {
  if (match.startedAt == null || match.queuedAt == null) return null;
  return Math.max(0, match.startedAt - match.queuedAt);
}

function longestPlayerWaitAtQueueMs(match: Match): number | null {
  if (match.startedAt == null || !match.availableSinceByPlayer) return null;
  const waits = Object.values(match.availableSinceByPlayer).map((since) =>
    Math.max(0, match.startedAt! - since)
  );
  return waits.length > 0 ? Math.max(...waits) : null;
}

/** Local queue analytics derived from queue state, courts, and player availability. */
export function computeQueueAnalytics(input: QueueAnalyticsInput): QueueAnalytics {
  const now = input.now ?? Date.now();
  const { queueState, courts, players } = input;
  const courtCount = Math.max(1, courts.length);
  const completed = queueState.completedMatches;

  const completedQueueWaits = completed
    .map(queueWaitMs)
    .filter((value): value is number => value != null);
  const currentQueueWaits = queueState.queue.map((entry) => Math.max(0, now - entry.createdAt));

  const completedMatchDurations = completed
    .map(matchDurationMs)
    .filter((value): value is number => value != null);

  const historicalAvailableWaits = completed
    .map(longestPlayerWaitAtQueueMs)
    .filter((value): value is number => value != null);

  const currentAvailableWaits = players
    .filter((player) => isPlayerMatchable(player) && player.availableSince != null)
    .map((player) => Math.max(0, now - (player.availableSince as number)));

  const allAvailableWaits = [...historicalAvailableWaits, ...currentAvailableWaits];
  const allQueueWaits = [...completedQueueWaits, ...currentQueueWaits];

  const hourAgo = now - 60 * 60 * 1000;
  const matchesCompletedLastHour = completed.filter(
    (match) => (match.completedAt ?? 0) >= hourAgo
  ).length;

  const sessionStart =
    input.sessionStartTime ??
    completed.find((match) => match.startedAt != null)?.startedAt ??
    null;

  let courtUtilizationPercent: number | null = null;
  if (sessionStart != null && now > sessionStart) {
    const sessionElapsedMs = now - sessionStart;
    const totalCourtSlotMs = sessionElapsedMs * courtCount;
    const completedBusyMs = completed.reduce(
      (sum, match) => sum + (matchDurationMs(match) ?? 0),
      0
    );
    const activeBusyMs = queueState.activeMatches.reduce((sum, match) => {
      if (match.startedAt == null) return sum;
      return sum + Math.max(0, now - match.startedAt);
    }, 0);
    courtUtilizationPercent = Math.min(
      100,
      Math.round(((completedBusyMs + activeBusyMs) / totalCourtSlotMs) * 100)
    );
  }

  return {
    avgQueueWaitMs: average(allQueueWaits),
    avgMatchDurationMs: average(completedMatchDurations),
    longestAvailableWaitMs:
      allAvailableWaits.length > 0 ? Math.max(...allAvailableWaits) : null,
    matchesCompletedThisSession: completed.length,
    matchesCompletedLastHour,
    courtUtilizationPercent,
    currentQueueDepth: queueState.queue.length,
  };
}

export function formatAnalyticsDuration(ms: number | null): string {
  if (ms == null) return '—';
  return formatQueueWaitDuration(ms);
}

export function formatAnalyticsMatchDuration(ms: number | null): string {
  if (ms == null) return '—';
  return formatMatchDuration(ms);
}

export function formatUtilizationPercent(value: number | null): string {
  if (value == null) return '—';
  return `${value}%`;
}
