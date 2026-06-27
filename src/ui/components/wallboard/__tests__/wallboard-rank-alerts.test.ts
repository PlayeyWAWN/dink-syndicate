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

  it('creates alerts for new top-10 entrants when baseline exists', () => {
    processWallboardRankAlerts([row(1, 'p1', 'Alice')]);
    const alerts = processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'new'),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('Bob');
    expect(hasActiveWallboardRankAlerts()).toBe(true);
  });

  it('creates knock commentary when a player climbs the board', () => {
    processWallboardRankAlerts([
      row(1, 'p1', 'Alice'),
      row(2, 'p3', 'Charlie'),
      row(3, 'p2', 'Bob'),
    ]);
    const alerts = processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'up'),
      row(3, 'p3', 'Charlie', 'down'),
    ]);
    expect(alerts.some((alert) => alert.message.includes('Bob'))).toBe(true);
    expect(alerts.some((alert) => alert.message.includes('Charlie'))).toBe(true);
    expect(alerts[0].message).toMatch(/knocks|snatches|stomps|bumping|shoves|climbs/i);
  });

  it('keeps alerts after delta changes on subsequent snapshots', () => {
    processWallboardRankAlerts([row(1, 'p1', 'Alice')]);
    processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'new'),
    ]);

    const alerts = processWallboardRankAlerts([
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'same'),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('Bob');
  });

  it('does not alert when everyone is new on first publish', () => {
    const rankings = [row(1, 'p1', 'Alice', 'new'), row(2, 'p2', 'Bob', 'new')];
    const alerts = processWallboardRankAlerts(rankings);
    expect(alerts).toHaveLength(0);
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
    const alerts = processWallboardRankAlerts(rankings);
    expect(alerts).toHaveLength(0);
  });
});
