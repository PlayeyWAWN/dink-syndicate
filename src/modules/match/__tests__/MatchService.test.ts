import { MatchService } from '@/modules/match/MatchService';
import { Match, QueueState } from '@/types/queue';
import { createPlayer } from '@/types/player';

describe('MatchService', () => {
  const service = new MatchService();

  it('completes active match and moves to completed list', () => {
    const match: Match = {
      id: 'm1',
      courtId: 'court-1',
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      format: 'doubles',
      status: 'active',
      winnerPlayerIds: [],
      startedAt: Date.now(),
    };
    const state: QueueState = { queue: [], activeMatches: [match], completedMatches: [] };
    const result = service.completeMatch(state, 'm1', ['p1', 'p2']);
    expect(result.state.activeMatches).toHaveLength(0);
    expect(result.state.completedMatches).toHaveLength(1);
  });

  it('updates player win/loss stats', () => {
    const match: Match = {
      id: 'm1',
      courtId: null,
      playerIds: ['p1', 'p2'],
      format: 'singles',
      status: 'completed',
      winnerPlayerIds: ['p1'],
      completedAt: Date.now(),
    };
    const players = [
      createPlayer({ id: 'p1', name: 'W' }),
      createPlayer({ id: 'p2', name: 'L' }),
    ];
    const updated = service.applyStats(players, match);
    expect(updated[0].wins).toBe(1);
    expect(updated[0].career.wins).toBe(1);
    expect(updated[0].career.gamesPlayed).toBe(1);
    expect(updated[1].losses).toBe(1);
    expect(updated[1].career.losses).toBe(1);
  });
});
