import { createId } from '@/modules/matchmaking/create-id';
import { winnerIdsForTeam } from '@/lib/format-utils';
import { Match, QueueState } from '@/types/queue';
import {
  emptyWinLoseStackState,
  ensureWinLoseStackState,
  WinLoseStackState,
} from '@/types/win-lose-stack';
import {
  clearLastPartnersForPlayers,
  partnerSplitPairing,
  updateLastPartners,
} from '@/modules/game-mode/partnerSplit';

export const WIN_LOSE_STACK_PLAYERS = 4;

export function getWinLoseStackPlayerIds(state: QueueState): Set<string> {
  const stack = state.winLoseStack;
  if (!stack) return new Set();
  return new Set([...stack.winnerStack, ...stack.loserStack]);
}

export function getNextUpStackIds(stack: WinLoseStackState): string[] {
  return stack.nextUp === 'winners' ? stack.winnerStack : stack.loserStack;
}

export function flipNextUp(stack: WinLoseStackState): WinLoseStackState {
  return {
    ...stack,
    nextUp: stack.nextUp === 'winners' ? 'losers' : 'winners',
  };
}

function setStackField(
  stack: WinLoseStackState,
  field: 'winnerStack' | 'loserStack',
  ids: string[]
): WinLoseStackState {
  return field === 'winnerStack'
    ? { ...stack, winnerStack: ids }
    : { ...stack, loserStack: ids };
}

function stackFieldForSource(sourceStack: 'winners' | 'losers'): 'winnerStack' | 'loserStack' {
  return sourceStack === 'winners' ? 'winnerStack' : 'loserStack';
}

function appendToStack(stack: WinLoseStackState, field: 'winnerStack' | 'loserStack', ids: string[]): WinLoseStackState {
  const current = field === 'winnerStack' ? stack.winnerStack : stack.loserStack;
  return setStackField(stack, field, [...current, ...ids]);
}

function prependToStack(stack: WinLoseStackState, field: 'winnerStack' | 'loserStack', ids: string[]): WinLoseStackState {
  const current = field === 'winnerStack' ? stack.winnerStack : stack.loserStack;
  return setStackField(stack, field, [...ids, ...current]);
}

function removeFromStacks(stack: WinLoseStackState, playerId: string): WinLoseStackState {
  return {
    ...stack,
    winnerStack: stack.winnerStack.filter((id) => id !== playerId),
    loserStack: stack.loserStack.filter((id) => id !== playerId),
  };
}

function removeFrontPlayers(
  stack: WinLoseStackState,
  sourceStack: 'winners' | 'losers',
  count: number
): { stack: WinLoseStackState; pulled: string[] } {
  const field = stackFieldForSource(sourceStack);
  const current = field === 'winnerStack' ? stack.winnerStack : stack.loserStack;
  const pulled = current.slice(0, count);
  const remaining = current.slice(count);
  return {
    stack: setStackField(stack, field, remaining),
    pulled,
  };
}

/** Route winners and losers to the back of their stacks after a match completes. */
export function routePlayersAfterMatchComplete(
  state: QueueState,
  match: Pick<Match, 'playerIds'>,
  winningTeam: 'A' | 'B'
): QueueState {
  const winnerIds = winnerIdsForTeam(match.playerIds, winningTeam);
  const winnerSet = new Set(winnerIds);
  const loserIds = match.playerIds.filter((id) => !winnerSet.has(id));

  let stack = ensureWinLoseStackState(state.winLoseStack);
  stack = appendToStack(stack, 'winnerStack', winnerIds);
  stack = appendToStack(stack, 'loserStack', loserIds);

  return { ...state, winLoseStack: stack };
}

export interface StartStackMatchResult {
  state: QueueState;
  match: Match | null;
  partnerConflict: boolean;
}

/** Pull the front four from Next-Up stack and create an active match on the given court. */
export function startNextStackMatch(
  state: QueueState,
  courtId: string
): StartStackMatchResult {
  let stack = ensureWinLoseStackState(state.winLoseStack);
  const sourceStack = stack.nextUp;
  const nextUpIds = getNextUpStackIds(stack);

  if (nextUpIds.length < WIN_LOSE_STACK_PLAYERS) {
    return { state, match: null, partnerConflict: false };
  }

  const { stack: afterPull, pulled } = removeFrontPlayers(
    stack,
    sourceStack,
    WIN_LOSE_STACK_PLAYERS
  );
  stack = afterPull;

  const { playerIds, hadPartnerConflict } = partnerSplitPairing(
    pulled,
    stack.lastPartnerByPlayer
  );
  stack = {
    ...stack,
    lastPartnerByPlayer: updateLastPartners(playerIds, stack.lastPartnerByPlayer),
  };
  stack = flipNextUp(stack);

  const now = Date.now();
  const match: Match = {
    id: createId('match'),
    courtId,
    playerIds,
    format: 'doubles',
    status: 'active',
    winnerPlayerIds: [],
    source: 'auto',
    startedAt: now,
    stackMeta: {
      sourceStack,
      stackPullOrder: pulled,
    },
  };

  return {
    state: {
      ...state,
      winLoseStack: stack,
      activeMatches: [...state.activeMatches, match],
    },
    match,
    partnerConflict: hadPartnerConflict,
  };
}

/** Append a checked-in player to the back of the winners stack. */
export function seedPlayerToWinnersStack(state: QueueState, playerId: string): QueueState {
  let stack = ensureWinLoseStackState(state.winLoseStack);
  if (
    stack.winnerStack.includes(playerId) ||
    stack.loserStack.includes(playerId) ||
    state.activeMatches.some((match) => match.playerIds.includes(playerId))
  ) {
    return state;
  }
  stack = appendToStack(stack, 'winnerStack', [playerId]);
  return { ...state, winLoseStack: stack };
}

export function removePlayerFromWinLoseStacks(state: QueueState, playerId: string): QueueState {
  if (!state.winLoseStack) return state;
  return {
    ...state,
    winLoseStack: removeFromStacks(state.winLoseStack, playerId),
  };
}

/** Return a cancelled stack match's players to the front of the source stack. */
export function returnStackMatchToQueue(
  state: QueueState,
  match: Pick<Match, 'playerIds' | 'stackMeta'>
): QueueState {
  if (!match.stackMeta) return state;

  let stack = ensureWinLoseStackState(state.winLoseStack);
  const field = stackFieldForSource(match.stackMeta.sourceStack);
  stack = prependToStack(stack, field, match.stackMeta.stackPullOrder);
  stack = {
    ...stack,
    lastPartnerByPlayer: clearLastPartnersForPlayers(match.playerIds, stack.lastPartnerByPlayer),
  };

  return { ...state, winLoseStack: stack };
}

export function resetWinLoseStackState(state: QueueState): QueueState {
  return { ...state, winLoseStack: emptyWinLoseStackState() };
}

export function seedCheckedInPlayersToWinnersStack(
  state: QueueState,
  checkedInPlayerIds: string[]
): QueueState {
  let next = resetWinLoseStackState(state);
  for (const playerId of checkedInPlayerIds) {
    next = seedPlayerToWinnersStack(next, playerId);
  }
  return next;
}

export function countNextUpStackPlayers(state: QueueState): number {
  const stack = state.winLoseStack;
  if (!stack) return 0;
  return getNextUpStackIds(stack).length;
}

export function countNextUpStackFromStack(stack: WinLoseStackState): number {
  return stack.nextUp === 'winners' ? stack.winnerStack.length : stack.loserStack.length;
}

export function canStartWinLoseStackMatch(state: QueueState): boolean {
  return countNextUpStackPlayers(state) >= WIN_LOSE_STACK_PLAYERS;
}

export function canStartFromStack(stack: WinLoseStackState): boolean {
  return countNextUpStackFromStack(stack) >= WIN_LOSE_STACK_PLAYERS;
}
