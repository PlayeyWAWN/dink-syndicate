import {
  buildInitialStackDistribution,
  getDefaultStackSelection,
  rebalanceStackQueuesIfNeeded,
  reorderPlayerInDueStack,
  resolveStackStartPlayerIds,
  routePlayersAfterMatchComplete,
  startNextStackMatch,
  removePlayerFromWinLoseStacks,
  returnStackMatchToQueue,
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

  it('splits 5+ waiting players evenly between piles at session start', () => {
    expect(buildInitialStackDistribution(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'])).toEqual({
      winnerStack: ['p1', 'p2', 'p3'],
      loserStack: ['p4', 'p5', 'p6'],
      nextUp: 'winners',
    });

    const twelve = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
    expect(buildInitialStackDistribution(twelve)).toEqual({
      winnerStack: twelve.slice(0, 6),
      loserStack: twelve.slice(6),
      nextUp: 'winners',
    });
  });

  it('rebalances when all waiting players were stuck in Winners only', () => {
    const stack = {
      winnerStack: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
      loserStack: [] as string[],
      nextUp: 'losers' as const,
      lastPartnerByPlayer: {},
    };
    const fixed = rebalanceStackQueuesIfNeeded(stack);
    expect(fixed.winnerStack).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(fixed.loserStack).toEqual(['p5', 'p6', 'p7', 'p8']);
    expect(fixed.nextUp).toBe('losers');
  });

  it('reverts Next-Up when a stack match is cancelled', () => {
    const state = baseState({
      winLoseStack: {
        winnerStack: ['p1', 'p2', 'p3', 'p4'],
        loserStack: [],
        nextUp: 'winners',
        lastPartnerByPlayer: {},
      },
    });

    const { state: afterStart, match } = startNextStackMatch(state, 'court-1');
    expect(afterStart.winLoseStack?.nextUp).toBe('losers');
    expect(match).not.toBeNull();

    const afterCancel = returnStackMatchToQueue(afterStart, match!);
    expect(afterCancel.winLoseStack?.nextUp).toBe('winners');
    expect(afterCancel.winLoseStack?.winnerStack).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('reorders a player within the Next-Up stack', () => {
    const state = baseState({
      winLoseStack: {
        winnerStack: ['p1', 'p2', 'p3', 'p4', 'p5'],
        loserStack: ['l1'],
        nextUp: 'winners',
        lastPartnerByPlayer: {},
      },
    });

    const movedDown = reorderPlayerInDueStack(state, 'p2', 'down');
    expect(movedDown?.winLoseStack?.winnerStack).toEqual(['p1', 'p3', 'p2', 'p4', 'p5']);

    const movedUp = reorderPlayerInDueStack(movedDown!, 'p2', 'up');
    expect(movedUp?.winLoseStack?.winnerStack).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('does not reorder players outside the Next-Up stack', () => {
    const state = baseState({
      winLoseStack: {
        winnerStack: ['p1', 'p2'],
        loserStack: ['l1', 'l2'],
        nextUp: 'losers',
        lastPartnerByPlayer: {},
      },
    });

    expect(reorderPlayerInDueStack(state, 'p1', 'down')).toBeNull();
  });

  it('starts a match with a custom four from the due stack (not front four)', () => {
    const state = baseState({
      winLoseStack: {
        winnerStack: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
        loserStack: [],
        nextUp: 'winners',
        lastPartnerByPlayer: {},
      },
    });

    const { state: nextState, match } = startNextStackMatch(state, 'court-1', {
      playerIds: ['p2', 'p4', 'p5', 'p6'],
    });

    expect(match).not.toBeNull();
    expect(match!.stackMeta?.stackPullOrder).toEqual(['p2', 'p4', 'p5', 'p6']);
    expect(nextState.winLoseStack?.winnerStack).toEqual(['p1', 'p3']);
    expect(nextState.winLoseStack?.nextUp).toBe('losers');
  });

  it('rejects a custom start when any player is not in the due stack', () => {
    const state = baseState({
      winLoseStack: {
        winnerStack: ['p1', 'p2', 'p3', 'p4'],
        loserStack: ['l1', 'l2', 'l3', 'l4'],
        nextUp: 'winners',
        lastPartnerByPlayer: {},
      },
    });

    const { match } = startNextStackMatch(state, 'court-1', {
      playerIds: ['p1', 'p2', 'p3', 'l1'],
    });
    expect(match).toBeNull();
  });

  it('restores custom pull order when a stack match is cancelled', () => {
    const state = baseState({
      winLoseStack: {
        winnerStack: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
        loserStack: [],
        nextUp: 'winners',
        lastPartnerByPlayer: {},
      },
    });

    const { state: afterStart, match } = startNextStackMatch(state, 'court-1', {
      playerIds: ['p2', 'p4', 'p5', 'p6'],
    });
    expect(match).not.toBeNull();

    const afterCancel = returnStackMatchToQueue(afterStart, match!);
    expect(afterCancel.winLoseStack?.winnerStack).toEqual(['p2', 'p4', 'p5', 'p6', 'p1', 'p3']);
    expect(afterCancel.winLoseStack?.nextUp).toBe('winners');
  });

  it('resolves manual start ids from selection or defaults to top four', () => {
    const stack = {
      winnerStack: ['p1', 'p2', 'p3', 'p4', 'p5'],
      loserStack: [],
      nextUp: 'winners' as const,
      lastPartnerByPlayer: {},
    };

    expect(getDefaultStackSelection(stack)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(resolveStackStartPlayerIds(stack, ['p2', 'p4', 'p5', 'p1'])).toEqual([
      'p1',
      'p2',
      'p4',
      'p5',
    ]);
    expect(resolveStackStartPlayerIds(stack, ['p1', 'p2'])).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
});
