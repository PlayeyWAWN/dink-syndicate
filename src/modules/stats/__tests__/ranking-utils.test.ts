import { comparePlayersForRanking, computeRankingPoints } from '@/modules/stats/ranking-utils';
import { createPlayer } from '@/types/player';

describe('ranking-utils', () => {
  describe('computeRankingPoints', () => {
    it('awards 3 points per win and 1 per loss', () => {
      expect(computeRankingPoints({ gamesPlayed: 5, wins: 5, losses: 0 })).toBe(15);
      expect(computeRankingPoints({ gamesPlayed: 10, wins: 6, losses: 4 })).toBe(22);
      expect(computeRankingPoints({ gamesPlayed: 11, wins: 3, losses: 8 })).toBe(17);
      expect(computeRankingPoints({ gamesPlayed: 0, wins: 0, losses: 0 })).toBe(0);
    });
  });

  describe('comparePlayersForRanking', () => {
    it('ranks active players above campers with fewer total points', () => {
      const camper = {
        ...createPlayer({ id: 'p1', name: 'Camper' }),
        gamesPlayed: 5,
        wins: 5,
        losses: 0,
      };
      const active = {
        ...createPlayer({ id: 'p2', name: 'Active' }),
        gamesPlayed: 10,
        wins: 6,
        losses: 4,
      };

      expect(comparePlayersForRanking(active, camper, 'session')).toBeLessThan(0);
      expect(comparePlayersForRanking(camper, active, 'session')).toBeGreaterThan(0);
    });

    it('breaks ties on points by wins', () => {
      const moreWins = {
        ...createPlayer({ id: 'p1', name: 'Alice' }),
        gamesPlayed: 5,
        wins: 4,
        losses: 1,
      };
      const fewerWins = {
        ...createPlayer({ id: 'p2', name: 'Bob' }),
        gamesPlayed: 7,
        wins: 3,
        losses: 4,
      };

      expect(computeRankingPoints({ gamesPlayed: 5, wins: 4, losses: 1 })).toBe(13);
      expect(computeRankingPoints({ gamesPlayed: 7, wins: 3, losses: 4 })).toBe(13);
      expect(comparePlayersForRanking(moreWins, fewerWins, 'session')).toBeLessThan(0);
    });

    it('sorts zero-game players to the bottom', () => {
      const inactive = createPlayer({ id: 'p1', name: 'Inactive' });
      const played = {
        ...createPlayer({ id: 'p2', name: 'Played' }),
        gamesPlayed: 1,
        wins: 0,
        losses: 1,
      };

      expect(comparePlayersForRanking(played, inactive, 'session')).toBeLessThan(0);
    });

    it('uses career stats when view is career', () => {
      const player = {
        ...createPlayer({ id: 'p1', name: 'Player' }),
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        career: { gamesPlayed: 4, wins: 3, losses: 1 },
      };
      const other = {
        ...createPlayer({ id: 'p2', name: 'Other' }),
        gamesPlayed: 10,
        wins: 10,
        losses: 0,
        career: { gamesPlayed: 2, wins: 1, losses: 1 },
      };

      expect(comparePlayersForRanking(player, other, 'career')).toBeLessThan(0);
      expect(comparePlayersForRanking(player, other, 'session')).toBeGreaterThan(0);
    });
  });
});
