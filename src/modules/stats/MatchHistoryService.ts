import { formatTeamLabel, matchLabel, splitTeams } from '@/lib/format-utils';
import {
  formatAnalyticsDuration,
  formatAnalyticsMatchDuration,
  QueueAnalytics,
} from '@/modules/stats/QueueAnalyticsService';
import { Player, isPlayerMatchable } from '@/types/player';
import { Match } from '@/types/queue';

export interface MatchHistoryRow {
  matchId: string;
  matchNumber: number;
  label: string;
  winnerLabel: string;
  waitLabel: string;
  durationLabel: string;
  completedAt: number | null;
  format: Match['format'];
  note?: string;
}

export interface WaitingPlayerRow {
  playerId: string;
  name: string;
  skillLabel: string;
  gamesPlayed: number;
  waitMs: number;
  waitLabel: string;
  availableSince: number;
}

export interface MatchHistoryData {
  matches: MatchHistoryRow[];
  waitingPlayers: WaitingPlayerRow[];
  analytics: QueueAnalytics;
}

function matchDurationMs(match: Match): number | null {
  if (match.startedAt == null || match.completedAt == null) return null;
  return Math.max(0, match.completedAt - match.startedAt);
}

function queueWaitMs(match: Match): number | null {
  if (match.startedAt == null || match.queuedAt == null) return null;
  return Math.max(0, match.startedAt - match.queuedAt);
}

function winnerLabel(match: Match, players: Player[]): string {
  const winners = new Set(match.winnerPlayerIds);
  if (winners.size === 0) return '—';

  const { teamA, teamB } = splitTeams(match.playerIds);
  if (teamA.length > 0 && teamA.every((id) => winners.has(id))) {
    return formatTeamLabel(match.playerIds, players, 'A');
  }
  if (teamB.length > 0 && teamB.every((id) => winners.has(id))) {
    return formatTeamLabel(match.playerIds, players, 'B');
  }

  return match.winnerPlayerIds
    .map((id) => players.find((player) => player.id === id)?.name ?? 'Unknown')
    .join(' & ');
}

/** Build completed-match history (newest first) and current longest-waiting players. */
export function buildMatchHistoryData(input: {
  completedMatches: Match[];
  players: Player[];
  analytics: QueueAnalytics;
  now?: number;
}): MatchHistoryData {
  const now = input.now ?? Date.now();
  const sorted = [...input.completedMatches].sort(
    (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
  );

  const matches: MatchHistoryRow[] = sorted.map((match, index) => ({
    matchId: match.id,
    matchNumber: sorted.length - index,
    label: matchLabel(match, input.players),
    winnerLabel: winnerLabel(match, input.players),
    waitLabel: formatAnalyticsDuration(queueWaitMs(match)),
    durationLabel: formatAnalyticsMatchDuration(matchDurationMs(match)),
    completedAt: match.completedAt ?? null,
    format: match.format,
    note: match.correctionNote?.trim() || undefined,
  }));

  const waitingPlayers = input.players
    .filter(
      (player) =>
        isPlayerMatchable(player) &&
        player.availableSince != null
    )
    .map((player) => {
      const waitMs = Math.max(0, now - (player.availableSince as number));
      return {
        playerId: player.id,
        name: player.name,
        skillLabel: String(player.dupr.duprDoublesRating ?? '—'),
        gamesPlayed: player.gamesPlayed,
        waitMs,
        waitLabel: formatAnalyticsDuration(waitMs),
        availableSince: player.availableSince as number,
      };
    })
    .sort((a, b) => b.waitMs - a.waitMs);

  return {
    matches,
    waitingPlayers,
    analytics: input.analytics,
  };
}

/** Longest queue wait among completed matches. */
export function longestMatchQueueWaitMs(completedMatches: Match[]): number | null {
  const waits = completedMatches
    .map(queueWaitMs)
    .filter((value): value is number => value != null);
  return waits.length > 0 ? Math.max(...waits) : null;
}

/** Longest match duration among completed matches. */
export function longestMatchDurationMs(completedMatches: Match[]): number | null {
  const durations = completedMatches
    .map(matchDurationMs)
    .filter((value): value is number => value != null);
  return durations.length > 0 ? Math.max(...durations) : null;
}

export const MATCH_HISTORY_PAGE_SIZE = 5;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
}

/** Slice a list for UI pagination (0-based page index). */
export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize = MATCH_HISTORY_PAGE_SIZE
): PaginatedResult<T> {
  if (items.length === 0) {
    return { items: [], page: 0, totalPages: 1, totalItems: 0, rangeStart: 0, rangeEnd: 0 };
  }

  const totalPages = Math.ceil(items.length / pageSize);
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    totalItems: items.length,
    rangeStart: start + 1,
    rangeEnd: Math.min(start + pageSize, items.length),
  };
}
