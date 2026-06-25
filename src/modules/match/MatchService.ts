import { Match, QueueState } from '@/types/queue';
import { Player } from '@/types/player';

/** Match completion and player stat updates. */
export class MatchService {
  completeMatch(
    state: QueueState,
    matchId: string,
    winnerPlayerIds: string[]
  ): { state: QueueState; players: Player[] | null } {
    const match = state.activeMatches.find((m) => m.id === matchId);
    if (!match) return { state, players: null };

    const completed: Match = {
      ...match,
      status: 'completed',
      winnerPlayerIds,
      completedAt: Date.now(),
    };

    return {
      state: {
        ...state,
        activeMatches: state.activeMatches.filter((m) => m.id !== matchId),
        completedMatches: [...state.completedMatches, completed],
      },
      players: null,
    };
  }

  applyStats(players: Player[], match: Match): Player[] {
    const now = Date.now();
    const winners = new Set(match.winnerPlayerIds);
    return players.map((p) => {
      if (!match.playerIds.includes(p.id)) return p;
      const won = winners.has(p.id);
      return {
        ...p,
        gamesPlayed: p.gamesPlayed + 1,
        wins: won ? p.wins + 1 : p.wins,
        losses: won ? p.losses : p.losses + 1,
        career: {
          gamesPlayed: p.career.gamesPlayed + 1,
          wins: won ? p.career.wins + 1 : p.career.wins,
          losses: won ? p.career.losses : p.career.losses + 1,
        },
        updatedAt: now,
      };
    });
  }

  /** Undo session + career stats applied when a completed match was recorded. */
  revertStats(players: Player[], match: Match): Player[] {
    const now = Date.now();
    const winners = new Set(match.winnerPlayerIds);
    return players.map((p) => {
      if (!match.playerIds.includes(p.id)) return p;
      const won = winners.has(p.id);
      return {
        ...p,
        gamesPlayed: Math.max(0, p.gamesPlayed - 1),
        wins: Math.max(0, won ? p.wins - 1 : p.wins),
        losses: Math.max(0, won ? p.losses : p.losses - 1),
        career: {
          gamesPlayed: Math.max(0, p.career.gamesPlayed - 1),
          wins: Math.max(0, won ? p.career.wins - 1 : p.career.wins),
          losses: Math.max(0, won ? p.career.losses : p.career.losses - 1),
        },
        updatedAt: now,
      };
    });
  }
}

export const matchService = new MatchService();
