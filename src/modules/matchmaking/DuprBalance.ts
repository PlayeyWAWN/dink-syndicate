import { MATCHMAKING_DUPR, MATCHMAKING_FAIRNESS, MATCHMAKING_LIMITS } from '@/config/matchmaking';
import { getSkillLevelFromDupr } from '@/lib/skill-utils';
import { Player } from '@/types/player';
import { duprDoublesRating, duprSinglesRating } from '@/modules/matchmaking/dupr-ratings';
import { fairnessRanker, FairnessRanker } from '@/modules/matchmaking/FairnessRanker';
import { searchMixedWithGamesGate, searchWithGamesGate } from '@/modules/matchmaking/gamesGate';
import {
  BalancedPairResult,
  BalancedQuartetResult,
  MatchmakingContext,
} from '@/modules/matchmaking/types';

export { duprDoublesRating, duprSinglesRating } from '@/modules/matchmaking/dupr-ratings';

export function teamAvgDupr(team: Player[]): number {
  return team.reduce((sum, player) => sum + duprDoublesRating(player), 0) / team.length;
}

function areMirrorDuprTeams(team1: Player[], team2: Player[]): boolean {
  const ratings1 = team1.map(duprDoublesRating).sort((a, b) => a - b);
  const ratings2 = team2.map(duprDoublesRating).sort((a, b) => a - b);
  return (
    Math.abs(ratings1[0] - ratings2[0]) < MATCHMAKING_DUPR.mirrorEpsilon &&
    Math.abs(ratings1[1] - ratings2[1]) < MATCHMAKING_DUPR.mirrorEpsilon
  );
}

export function isDuprMatchBalanced(team1: Player[], team2: Player[]): boolean {
  const mirror = areMirrorDuprTeams(team1, team2);
  const maxInternalGap = mirror
    ? MATCHMAKING_DUPR.maxInternalGapMirror
    : MATCHMAKING_DUPR.maxInternalGap;
  const maxTeamAvgDiff = mirror
    ? MATCHMAKING_DUPR.maxTeamAvgDiffMirror
    : MATCHMAKING_DUPR.maxTeamAvgDiff;
  const maxOverallSpan = mirror
    ? MATCHMAKING_DUPR.maxOverallSpanMirror
    : MATCHMAKING_DUPR.maxOverallSpan;

  const internalOk = (team: Player[]) => {
    const ratings = team.map(duprDoublesRating);
    return Math.max(...ratings) - Math.min(...ratings) <= maxInternalGap;
  };

  if (!internalOk(team1) || !internalOk(team2)) return false;
  if (Math.abs(teamAvgDupr(team1) - teamAvgDupr(team2)) > maxTeamAvgDiff) return false;

  const allRatings = [...team1, ...team2].map(duprDoublesRating);
  return Math.max(...allRatings) - Math.min(...allRatings) <= maxOverallSpan;
}

export function isSinglesPairBalanced(playerA: Player, playerB: Player): boolean {
  const gap = Math.abs(duprSinglesRating(playerA) - duprSinglesRating(playerB));
  const mirror = gap < MATCHMAKING_DUPR.mirrorEpsilon;
  const maxAllowedGap = mirror
    ? MATCHMAKING_DUPR.singlesMaxGapMirror
    : MATCHMAKING_DUPR.singlesMaxGap;
  return gap <= maxAllowedGap;
}

/** Balance four players into two teams by 1+4 vs 2+3 DUPR totals (legacy helper). */
export function balanceDoublesTeamsBySplit(players: Player[]): string[] {
  if (players.length < 4) return players.map((player) => player.id);
  const sorted = [...players].sort((a, b) => duprDoublesRating(a) - duprDoublesRating(b));
  const [p1, p2, p3, p4] = sorted.slice(0, 4);
  const teamA = duprDoublesRating(p1) + duprDoublesRating(p4);
  const teamB = duprDoublesRating(p2) + duprDoublesRating(p3);
  if (teamA <= teamB) return [p1.id, p4.id, p2.id, p3.id];
  return [p2.id, p3.id, p1.id, p4.id];
}

/** Pair 2 males with 2 females into 1m+1f teams with closest total DUPR. */
export function balanceMixedDoublesTeams(players: Player[]): string[] {
  const males = [...players.filter((player) => player.gender === 'male')].sort(
    (a, b) => duprDoublesRating(a) - duprDoublesRating(b)
  );
  const females = [...players.filter((player) => player.gender === 'female')].sort(
    (a, b) => duprDoublesRating(a) - duprDoublesRating(b)
  );
  if (males.length < 2 || females.length < 2) {
    return players.map((player) => player.id);
  }

  const [m1, m2] = males;
  const [f1, f2] = females;
  const pairA = duprDoublesRating(m1) + duprDoublesRating(f1);
  const pairB = duprDoublesRating(m2) + duprDoublesRating(f2);
  const altA = duprDoublesRating(m1) + duprDoublesRating(f2);
  const altB = duprDoublesRating(m2) + duprDoublesRating(f1);

  if (Math.abs(pairA - pairB) <= Math.abs(altA - altB)) {
    return [m1.id, f1.id, m2.id, f2.id];
  }
  return [m1.id, f2.id, m2.id, f1.id];
}

function mixedTeamsFromIds(quartet: Player[], playerIds: string[]): [Player[], Player[]] {
  const byId = new Map(quartet.map((player) => [player.id, player]));
  return [
    [byId.get(playerIds[0])!, byId.get(playerIds[1])!],
    [byId.get(playerIds[2])!, byId.get(playerIds[3])!],
  ];
}

function findBestBalancedMixedQuartet(
  malePool: Player[],
  femalePool: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker
): BalancedQuartetResult | null {
  let best: BalancedQuartetResult | null = null;

  for (let i = 0; i < malePool.length - 1; i += 1) {
    for (let j = i + 1; j < malePool.length; j += 1) {
      for (let k = 0; k < femalePool.length - 1; k += 1) {
        for (let l = k + 1; l < femalePool.length; l += 1) {
          const quartet = [malePool[i], malePool[j], femalePool[k], femalePool[l]];
          const playerIds = balanceMixedDoublesTeams(quartet);
          const [team1, team2] = mixedTeamsFromIds(quartet, playerIds);
          if (!isDuprMatchBalanced(team1, team2)) continue;

          const finalScore = scoreQuartet(quartet, team1, team2, context, ranker);
          if (!best || finalScore < best.score) {
            best = {
              teamA: [team1[0].id, team1[1].id],
              teamB: [team2[0].id, team2[1].id],
              score: finalScore,
            };
          }
        }
      }
    }
  }

  return best;
}

function tryMixedQuartetFromTopPriority(
  malePool: Player[],
  femalePool: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker
): BalancedQuartetResult | null {
  if (malePool.length < 2 || femalePool.length < 2) return null;

  const quartet = [malePool[0], malePool[1], femalePool[0], femalePool[1]];
  const playerIds = balanceMixedDoublesTeams(quartet);
  const [team1, team2] = mixedTeamsFromIds(quartet, playerIds);
  if (!isDuprMatchBalanced(team1, team2)) return null;

  return {
    teamA: [team1[0].id, team1[1].id],
    teamB: [team2[0].id, team2[1].id],
    score: scoreQuartet(quartet, team1, team2, context, ranker),
  };
}

function findBestBalancedMixedQuartetBounded(
  malePool: Player[],
  femalePool: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker,
  maxPerGender: number
): BalancedQuartetResult | null {
  const quick = tryMixedQuartetFromTopPriority(malePool, femalePool, context, ranker);
  if (quick) return quick;

  const males = malePool.length > maxPerGender ? malePool.slice(0, maxPerGender) : malePool;
  const females =
    femalePool.length > maxPerGender ? femalePool.slice(0, maxPerGender) : femalePool;
  return findBestBalancedMixedQuartet(males, females, context, ranker);
}

/** Games-first gate, then Smash-style top-2 mix with bounded fallback search. */
export function findBestBalancedMixedDoublesMatch(
  available: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker = fairnessRanker,
  maxPerGender = MATCHMAKING_LIMITS.maxMixedCandidatesPerGender
): BalancedQuartetResult | null {
  const males = ranker.sortByFairness(
    available.filter((player) => player.gender === 'male'),
    context
  );
  const females = ranker.sortByFairness(
    available.filter((player) => player.gender === 'female'),
    context
  );

  if (males.length < 2 || females.length < 2) return null;

  return searchMixedWithGamesGate(males, females, maxPerGender, (maleBucket, femaleBucket) =>
    findBestBalancedMixedQuartetBounded(maleBucket, femaleBucket, context, ranker, maxPerGender)
  );
}

const TEAM_SPLITS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

function teamSkillProfile(team: Player[]): string {
  return team
    .map((player) => getSkillLevelFromDupr(player.dupr.duprDoublesRating))
    .sort()
    .join('+');
}

function tierMirrorBonus(team1: Player[], team2: Player[]): number {
  return teamSkillProfile(team1) === teamSkillProfile(team2) ? -1 : 0;
}

function teamSplitsForQuartet(quartet: Player[]): Array<[Player[], Player[]]> {
  const byDupr = [...quartet].sort((a, b) => duprDoublesRating(a) - duprDoublesRating(b));
  return TEAM_SPLITS.map(([a, b, c, d]) => [[byDupr[a], byDupr[b]], [byDupr[c], byDupr[d]]]);
}

function findBestQuartetInPool(
  pool: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker,
  maxCandidates: number
): BalancedQuartetResult | null {
  const candidates = pool.length > maxCandidates ? pool.slice(0, maxCandidates) : pool;
  if (candidates.length < 4) return null;

  let best: BalancedQuartetResult | null = null;

  for (let i = 0; i < candidates.length - 3; i += 1) {
    for (let j = i + 1; j < candidates.length - 2; j += 1) {
      for (let k = j + 1; k < candidates.length - 1; k += 1) {
        for (let l = k + 1; l < candidates.length; l += 1) {
          const quartet = [candidates[i], candidates[j], candidates[k], candidates[l]];

          for (const [team1, team2] of teamSplitsForQuartet(quartet)) {
            if (!isDuprMatchBalanced(team1, team2)) continue;

            const finalScore = scoreQuartet(quartet, team1, team2, context, ranker);
            if (!best || finalScore < best.score) {
              best = {
                teamA: [team1[0].id, team1[1].id],
                teamB: [team2[0].id, team2[1].id],
                score: finalScore,
              };
            }
          }
        }
      }
    }
  }

  return best;
}

export function findBestBalancedQuartetWithGamesGate(
  pool: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker,
  maxCandidates: number
): BalancedQuartetResult | null {
  const ordered = ranker.sortByFairness(pool, context);
  if (ordered.length < 4) return null;

  return searchWithGamesGate(ordered, 4, maxCandidates, (bucket) =>
    findBestQuartetInPool(bucket, context, ranker, maxCandidates)
  );
}

function scoreQuartet(
  quartet: Player[],
  team1: Player[],
  team2: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker
): number {
  const balanceScore = Math.abs(teamAvgDupr(team1) - teamAvgDupr(team2));
  const totalGames = quartet.reduce((sum, player) => sum + player.gamesPlayed, 0);
  const arrivalPenalty =
    ranker.quartetPenaltyScore(quartet, context) * context.lateMinutesWeight;
  return balanceScore + totalGames + arrivalPenalty + tierMirrorBonus(team1, team2);
}

/** Combinatorial search for the best DUPR-balanced doubles quartet in a pool. */
export function findBestBalancedQuartetInPool(
  pool: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker = fairnessRanker,
  maxCandidates = MATCHMAKING_LIMITS.maxDoublesCandidates
): BalancedQuartetResult | null {
  return findBestQuartetInPool(pool, context, ranker, maxCandidates);
}

/** Games-first gate, then combinatorial DUPR search across the eligible pool. */
export function findBestBalancedDoublesMatch(
  available: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker = fairnessRanker
): BalancedQuartetResult | null {
  return findBestBalancedQuartetWithGamesGate(
    available,
    context,
    ranker,
    MATCHMAKING_LIMITS.maxDoublesCandidates
  );
}

export function findBestBalancedSinglesPair(
  pool: Player[],
  context: MatchmakingContext,
  ranker: FairnessRanker = fairnessRanker,
  maxCandidates = MATCHMAKING_LIMITS.maxSinglesCandidates
): BalancedPairResult | null {
  const candidates = pool.length > maxCandidates ? pool.slice(0, maxCandidates) : pool;
  if (candidates.length < 2) return null;

  let best: BalancedPairResult | null = null;

  for (let i = 0; i < candidates.length - 1; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const playerA = candidates[i];
      const playerB = candidates[j];
      if (!isSinglesPairBalanced(playerA, playerB)) continue;

      const ratingGap = Math.abs(duprSinglesRating(playerA) - duprSinglesRating(playerB));
      const totalGames = playerA.gamesPlayed + playerB.gamesPlayed;
      const arrivalPenalty =
        ranker.pairPenaltyScore(playerA, playerB, context) * context.lateMinutesWeight;
      const finalScore = ratingGap + totalGames + arrivalPenalty;

      if (!best || finalScore < best.score) {
        best = { playerA: playerA.id, playerB: playerB.id, score: finalScore };
      }
    }
  }

  return best;
}
