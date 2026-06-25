import { RANKING_POINTS } from '@/config/ranking';
import { Player, PlayerStats, StatsView, getPlayerStatsForView } from '@/types/player';

/** Derive ranking points from wins and losses. */
export function computeRankingPoints(stats: PlayerStats): number {
  return stats.wins * RANKING_POINTS.win + stats.losses * RANKING_POINTS.loss;
}

function winRatePercent(wins: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return Math.round((wins / gamesPlayed) * 100);
}

/** Sort players by points, then wins, win rate, games played, and name. */
export function comparePlayersForRanking(
  a: Player,
  b: Player,
  view: StatsView
): number {
  const statsA = getPlayerStatsForView(a, view);
  const statsB = getPlayerStatsForView(b, view);

  const pointsA = computeRankingPoints(statsA);
  const pointsB = computeRankingPoints(statsB);
  if (pointsB !== pointsA) return pointsB - pointsA;

  if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;

  const rateA = winRatePercent(statsA.wins, statsA.gamesPlayed);
  const rateB = winRatePercent(statsB.wins, statsB.gamesPlayed);
  if (rateB !== rateA) return rateB - rateA;

  if (statsB.gamesPlayed !== statsA.gamesPlayed) {
    return statsB.gamesPlayed - statsA.gamesPlayed;
  }

  return a.name.localeCompare(b.name);
}
