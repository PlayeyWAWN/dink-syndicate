import {
  hasActiveWallboardRankAlerts,
  processWallboardRankAlerts,
  resetWallboardRankAlerts,
} from '@/ui/components/wallboard/wallboard-rank-alerts';
import { PublicRankingRow } from '@/types/live';

function row(
  rank: number,
  playerId: string,
  name: string,
  delta?: PublicRankingRow['delta']
): PublicRankingRow {
  return {
    rank,
    playerId,
    name,
    points: 0,
    wins: 0,
    losses: 0,
    gamesPlayed: 1,
    delta,
  };
}

describe('processWallboardRankAlerts', () => {
  beforeEach(() => {
    resetWallboardRankAlerts();
  });

  it('creates a highlight for new top-10 entrants when baseline exists', () => {
    processWallboardRankAlerts([row(1, 'p1', 'Alice')]);
    const highlight = processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'new'),
    ]);
    expect(highlight?.message).toContain('Bob');
    expect(hasActiveWallboardRankAlerts()).toBe(true);
  });

  it('replaces the highlight when a newer event occurs', () => {
    processWallboardRankAlerts([row(1, 'p1', 'Alice')]);
    processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'new'),
    ]);

    const highlight = processWallboardRankAlerts([
      row(1, 'p2', 'Bob', 'up'),
      row(2, 'p1', 'Alice', 'down'),
    ]);
    expect(highlight?.message).toContain('Bob');
    expect(highlight?.message).not.toContain('enters');
  });

  it('creates knock commentary when a player climbs the board', () => {
    processWallboardRankAlerts([
      row(1, 'p1', 'Alice'),
      row(2, 'p3', 'Charlie'),
      row(3, 'p2', 'Bob'),
    ]);
    const highlight = processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'up'),
      row(3, 'p3', 'Charlie', 'down'),
    ]);
    expect(highlight?.message).toContain('Bob');
    expect(highlight?.message).toMatch(/knocks|snatches|stomps|bumping|shoves|climbs|moved up/i);
  });

  it('does not alert when everyone is new on first publish', () => {
    const rankings = [row(1, 'p1', 'Alice', 'new'), row(2, 'p2', 'Bob', 'new')];
    const highlight = processWallboardRankAlerts(rankings);
    expect(highlight).toBeNull();
  });

  it('does not alert when nobody has played yet', () => {
    const rankings = [
      {
        rank: 1,
        playerId: 'p1',
        name: 'Alice',
        points: 0,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        delta: 'new' as const,
      },
    ];
    const highlight = processWallboardRankAlerts(rankings);
    expect(highlight).toBeNull();
  });

  it('only keeps one highlight instead of stacking many', () => {
    processWallboardRankAlerts([row(1, 'p1', 'Alice')]);
    processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'new'),
      row(3, 'p3', 'Charlie', 'new'),
    ]);
    const highlight = processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'same'),
      row(3, 'p3', 'Charlie', 'same'),
    ]);
    expect(highlight).not.toBeNull();
    expect(highlight?.message).toBeTruthy();
  });
});
