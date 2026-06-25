import { splitTeams, winRate } from '@/lib/format-utils';
import { MIN_GAMES_FOR_STAR_PLAYER } from '@/config/ranking';
import { comparePlayersForRanking, computeRankingPoints } from '@/modules/stats/ranking-utils';
import { QueueAnalytics } from '@/modules/stats/QueueAnalyticsService';
import { Player, StatsView, getPlayerStatsForView } from '@/types/player';
import { Match } from '@/types/queue';

export { MIN_GAMES_FOR_STAR_PLAYER } from '@/config/ranking';
export const MIN_GAMES_FOR_TOP_PAIR = 1;
export const REPORT_TOP_N = 5;

export interface StarPlayerRow {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  points: number;
  winRatePercent: number;
  winRateLabel: string;
}

export interface TopPairRow {
  playerIds: [string, string];
  label: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRatePercent: number;
  winRateLabel: string;
}

export interface EncouragementPlayerRow {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRateLabel: string;
}

export interface RankingsRow {
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  winRateLabel: string;
  rating: string;
}

export interface StatsReportData {
  statsView: StatsView;
  sessionName: string;
  generatedAt: Date;
  summary: {
    gamesPlayed: number;
    matchesCompleted: number;
    activeNow: number;
    players: number;
  };
  analytics: QueueAnalytics;
  starPlayers: StarPlayerRow[];
  pairStatistics: TopPairRow[];
  playersNeedingEncouragement: EncouragementPlayerRow[];
  rankings: RankingsRow[];
}

function winRatePercent(wins: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return Math.round((wins / gamesPlayed) * 100);
}

function pairKey(playerA: string, playerB: string): string {
  return [playerA, playerB].sort().join('|');
}

function recordPairResult(
  pairs: Map<string, TopPairRow>,
  playerIds: string[],
  playersById: Map<string, Player>,
  won: boolean
): void {
  if (playerIds.length !== 2) return;
  const [idA, idB] = playerIds;
  const key = pairKey(idA, idB);
  const nameA = playersById.get(idA)?.name ?? 'Unknown';
  const nameB = playersById.get(idB)?.name ?? 'Unknown';
  const existing = pairs.get(key) ?? {
    playerIds: [idA, idB].sort() as [string, string],
    label: `${nameA} & ${nameB}`,
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    winRatePercent: 0,
    winRateLabel: '—',
  };

  existing.gamesPlayed += 1;
  if (won) existing.wins += 1;
  else existing.losses += 1;
  existing.winRatePercent = winRatePercent(existing.wins, existing.gamesPlayed);
  existing.winRateLabel = winRate(existing.wins, existing.gamesPlayed);
  pairs.set(key, existing);
}

function collectPairStatistics(
  completedMatches: Match[],
  players: Player[]
): Map<string, TopPairRow> {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const pairs = new Map<string, TopPairRow>();

  for (const match of completedMatches) {
    if (match.format === 'singles' || match.playerIds.length < 4) continue;

    const { teamA, teamB } = splitTeams(match.playerIds);
    const winners = new Set(match.winnerPlayerIds);
    const teamAWon = teamA.every((id) => winners.has(id));
    const teamBWon = teamB.every((id) => winners.has(id));

    if (teamAWon) {
      recordPairResult(pairs, teamA, playersById, true);
      recordPairResult(pairs, teamB, playersById, false);
    } else if (teamBWon) {
      recordPairResult(pairs, teamA, playersById, false);
      recordPairResult(pairs, teamB, playersById, true);
    }
  }

  return pairs;
}

export function buildStarPlayers(players: Player[], statsView: StatsView): StarPlayerRow[] {
  return [...players]
    .filter((player) => getPlayerStatsForView(player, statsView).gamesPlayed >= MIN_GAMES_FOR_STAR_PLAYER)
    .sort((a, b) => comparePlayersForRanking(a, b, statsView))
    .slice(0, REPORT_TOP_N)
    .map((player) => {
      const stats = getPlayerStatsForView(player, statsView);
      return {
        playerId: player.id,
        name: player.name,
        wins: stats.wins,
        losses: stats.losses,
        gamesPlayed: stats.gamesPlayed,
        points: computeRankingPoints(stats),
        winRatePercent: winRatePercent(stats.wins, stats.gamesPlayed),
        winRateLabel: winRate(stats.wins, stats.gamesPlayed),
      };
    });
}

/** Winning partnerships ranked by wins, then win rate. */
export function buildPairStatistics(
  completedMatches: Match[],
  players: Player[]
): TopPairRow[] {
  return [...collectPairStatistics(completedMatches, players).values()]
    .filter((row) => row.gamesPlayed >= MIN_GAMES_FOR_TOP_PAIR && row.wins > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRatePercent !== a.winRatePercent) return b.winRatePercent - a.winRatePercent;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return a.label.localeCompare(b.label);
    })
    .slice(0, REPORT_TOP_N);
}

export function buildPlayersNeedingEncouragement(
  players: Player[],
  statsView: StatsView
): EncouragementPlayerRow[] {
  const withLosses = players
    .map((player) => {
      const stats = getPlayerStatsForView(player, statsView);
      return {
        playerId: player.id,
        name: player.name,
        wins: stats.wins,
        losses: stats.losses,
        gamesPlayed: stats.gamesPlayed,
        winRateLabel: winRate(stats.wins, stats.gamesPlayed),
      };
    })
    .filter((row) => row.gamesPlayed > 0 && row.losses > 0);

  if (withLosses.length === 0) return [];

  const maxLosses = Math.max(...withLosses.map((row) => row.losses));
  return withLosses
    .filter((row) => row.losses === maxLosses)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** @deprecated Use buildPairStatistics. */
export function buildTopPairs(completedMatches: Match[], players: Player[]): TopPairRow[] {
  return buildPairStatistics(completedMatches, players);
}

export function buildRankingsRows(players: Player[], statsView: StatsView): RankingsRow[] {
  return [...players]
    .sort((a, b) => comparePlayersForRanking(a, b, statsView))
    .map((player) => {
      const stats = getPlayerStatsForView(player, statsView);
      return {
        name: player.name,
        gamesPlayed: stats.gamesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        points: computeRankingPoints(stats),
        winRateLabel: winRate(stats.wins, stats.gamesPlayed),
        rating: String(player.dupr.duprDoublesRating ?? '—'),
      };
    });
}

export interface IndexedRankingsRow {
  row: RankingsRow;
  rankIndex: number;
}

/** Full rankings with stable rank positions, optionally filtered by player name. */
export function buildIndexedRankingsRows(
  players: Player[],
  statsView: StatsView,
  searchQuery = ''
): IndexedRankingsRow[] {
  const trimmed = searchQuery.trim().toLowerCase();
  return buildRankingsRows(players, statsView)
    .map((row, rankIndex) => ({ row, rankIndex }))
    .filter(({ row }) => !trimmed || row.name.toLowerCase().includes(trimmed));
}

export function buildStatsReportData(input: {
  statsView: StatsView;
  sessionName: string;
  players: Player[];
  completedMatches: Match[];
  activeMatchCount: number;
  analytics: QueueAnalytics;
  generatedAt?: Date;
}): StatsReportData {
  const statsView = input.statsView;
  const totalGames = input.players.reduce(
    (sum, player) => sum + getPlayerStatsForView(player, statsView).gamesPlayed,
    0
  );

  return {
    statsView,
    sessionName: input.sessionName,
    generatedAt: input.generatedAt ?? new Date(),
    summary: {
      gamesPlayed: totalGames,
      matchesCompleted: input.completedMatches.length,
      activeNow: input.activeMatchCount,
      players: input.players.length,
    },
    analytics: input.analytics,
    starPlayers: buildStarPlayers(input.players, statsView),
    pairStatistics: buildPairStatistics(input.completedMatches, input.players),
    playersNeedingEncouragement: buildPlayersNeedingEncouragement(input.players, statsView),
    rankings: buildRankingsRows(input.players, statsView),
  };
}

export function formatReportGeneratedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function statsViewLabel(view: StatsView): string {
  return view === 'session' ? 'This session' : 'Career';
}

export function statsViewExportSlug(view: StatsView): string {
  return view === 'session' ? 'session' : 'career';
}
