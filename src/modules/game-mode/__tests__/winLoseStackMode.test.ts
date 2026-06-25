import {
  routePlayersAfterMatchComplete,
  startNextStackMatch,
  removePlayerFromWinLoseStacks,
} from '@/modules/game-mode/winLoseStackMode';
import { emptyWinLoseStackState } from '@/types/win-lose-stack';
import { QueueState } from '@/types/queue';

function baseState(overrides: Partial<QueueState> = {}): QueueState {
  return {
    queue: [],
    activeMatches: [],
    completedMatches: [],
    winLoseStack: emptyWinLoseStackState(),
    ...overrides,
  };
}

describe('winLoseStackMode', () => {
  it('routes winners and losers to the back of their stacks after a match', () => {
    const state = baseState();
    const routed = routePlayersAfterMatchComplete(
      state,
      { playerIds: ['w1', 'w2', 'l1', 'l2'] },
      'A'
    );
    expect(routed.winLoseStack?.winnerStack).toEqual(['w1', 'w2']);
    expect(routed.winLoseStack?.loserStack).toEqual(['l1', 'l2']);
  });

  it('starts a match from the Next-Up stack and flips the indicator', () => {
    const state = baseState({
      winLoseStack: {
        winnerStack: ['p1', 'p2', 'p3', 'p4'],
        loserStack: [],
        nextUp: 'winners',
        lastPartnerByPlayer: {},
      },
    });

    const { state: nextState, match } = startNextStackMatch(state, 'court-1');
    expect(match).not.toBeNull();
    expect(match!.playerIds).toHaveLength(4);
    expect(nextState.winLoseStack?.winnerStack).toEqual([]);
    expect(nextState.winLoseStack?.nextUp).toBe('losers');
    expect(nextState.activeMatches).toHaveLength(1);
  });

  it('removes a player from both stacks on check-out', () => {
    const state = baseState({
      winLoseStack: {
        winnerStack: ['p1', 'p2'],
        loserStack: ['p3'],
        nextUp: 'winners',
        lastPartnerByPlayer: {},
      },
    });

    const next = removePlayerFromWinLoseStacks(state, 'p2');
    expect(next.winLoseStack?.winnerStack).toEqual(['p1']);
    expect(next.winLoseStack?.loserStack).toEqual(['p3']);
  });
});
