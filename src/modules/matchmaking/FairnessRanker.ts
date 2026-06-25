import { MATCHMAKING_FAIRNESS } from '@/config/matchmaking';
import { Player } from '@/types/player';
import { duprDoublesRating, duprSinglesRating } from '@/modules/matchmaking/dupr-ratings';
import { MatchmakingContext, SessionSettings } from '@/modules/matchmaking/types';

/** Games-played gate, arrival penalty, and candidate ordering for Find Match. */
export class FairnessRanker {
  createContext(sessionSettings?: SessionSettings): MatchmakingContext {
    return {
      sessionStartTime: sessionSettings?.sessionStartTime,
      arrivalGraceMinutes:
        sessionSettings?.arrivalGraceMinutes ?? MATCHMAKING_FAIRNESS.defaultGraceMinutes,
      arrivalPenaltyEnabled:
        sessionSettings?.arrivalPenaltyEnabled ??
        MATCHMAKING_FAIRNESS.defaultArrivalPenaltyEnabled,
      lateMinutesWeight:
        sessionSettings?.lateMinutesWeight ?? MATCHMAKING_FAIRNESS.lateMinutesWeight,
    };
  }

  lateMinutes(player: Player, context: MatchmakingContext): number {
    if (!context.arrivalPenaltyEnabled || context.sessionStartTime == null) return 0;
    const checkedInAt = player.checkedInAt ?? player.availableSince;
    if (checkedInAt == null) return 0;
    const graceMs = context.arrivalGraceMinutes * 60 * 1000;
    const lateMs = checkedInAt - context.sessionStartTime - graceMs;
    return Math.max(0, Math.floor(lateMs / 60_000));
  }

  fairnessSortScore(player: Player, context: MatchmakingContext, useSingles = false): number {
    const rating = useSingles ? duprSinglesRating(player) : duprDoublesRating(player);
    return (
      player.gamesPlayed * MATCHMAKING_FAIRNESS.gamesPlayedWeight +
      this.lateMinutes(player, context) * context.lateMinutesWeight +
      rating
    );
  }

  sortByFairness(players: Player[], context: MatchmakingContext): Player[] {
    return [...players].sort(
      (a, b) => this.fairnessSortScore(a, context) - this.fairnessSortScore(b, context)
    );
  }

  sortBySinglesFairness(players: Player[], context: MatchmakingContext): Player[] {
    return [...players].sort(
      (a, b) =>
        this.fairnessSortScore(a, context, true) - this.fairnessSortScore(b, context, true)
    );
  }

  quartetPenaltyScore(players: Player[], context: MatchmakingContext): number {
    return players.reduce((sum, player) => sum + this.lateMinutes(player, context), 0);
  }

  pairPenaltyScore(playerA: Player, playerB: Player, context: MatchmakingContext): number {
    return this.lateMinutes(playerA, context) + this.lateMinutes(playerB, context);
  }

  /** Expand max-games ceiling until bucket has enough players. */
  filterByGamesBucket(ordered: Player[], minCount: number): Player[] | null {
    if (ordered.length < minCount) return null;
    const minGames = Math.min(...ordered.map((player) => player.gamesPlayed));
    const maxGames = Math.max(...ordered.map((player) => player.gamesPlayed));

    for (let allowedMaxGames = minGames; allowedMaxGames <= maxGames; allowedMaxGames += 1) {
      const bucket = ordered.filter((player) => player.gamesPlayed <= allowedMaxGames);
      if (bucket.length >= minCount) return bucket;
    }

    return null;
  }
}

export const fairnessRanker = new FairnessRanker();
