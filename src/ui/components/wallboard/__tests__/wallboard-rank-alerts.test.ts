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
    const rankings = [
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'new'),
    ];
    const alerts = processWallboardRankAlerts(rankings);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('Bob');
    expect(hasActiveWallboardRankAlerts()).toBe(true);
  });

  it('keeps alerts after delta changes on subsequent snapshots', () => {
    const first = [
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'new'),
    ];
    processWallboardRankAlerts(first);

    const second = [
      row(1, 'p1', 'Alice', 'same'),
      row(2, 'p2', 'Bob', 'same'),
    ];
    const alerts = processWallboardRankAlerts(second);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain('Bob');
  });

  it('does not alert when everyone is new on first publish', () => {
    const rankings = [row(1, 'p1', 'Alice', 'new'), row(2, 'p2', 'Bob', 'new')];
    const alerts = processWallboardRankAlerts(rankings);
    expect(alerts).toHaveLength(0);
  });
});
