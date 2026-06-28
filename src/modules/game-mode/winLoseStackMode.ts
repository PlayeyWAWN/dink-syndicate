import { createId } from '@/modules/matchmaking/create-id';
import { winnerIdsForTeam } from '@/lib/format-utils';
import { Match, QueueState } from '@/types/queue';
import { isPlayerMatchable, Player } from '@/types/player';
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

function removeSpecificPlayersFromDueStack(
  stack: WinLoseStackState,
  playerIds: string[]
): { stack: WinLoseStackState; pulled: string[] } | null {
  const sourceStack = stack.nextUp;
  const field = stackFieldForSource(sourceStack);
  const dueIds = getNextUpStackIds(stack);

  if (playerIds.length !== WIN_LOSE_STACK_PLAYERS) return null;
  if (new Set(playerIds).size !== WIN_LOSE_STACK_PLAYERS) return null;

  const dueSet = new Set(dueIds);
  if (!playerIds.every((id) => dueSet.has(id))) return null;

  const selectedSet = new Set(playerIds);
  const pulled = dueIds.filter((id) => selectedSet.has(id));
  const remaining = dueIds.filter((id) => !selectedSet.has(id));

  return {
    stack: setStackField(stack, field, remaining),
    pulled,
  };
}

/** First four players in the Next-Up stack — default manual selection. */
export function getDefaultStackSelection(stack: WinLoseStackState): string[] {
  return getNextUpStackIds(stack).slice(0, WIN_LOSE_STACK_PLAYERS);
}

/** Resolve manual start lineup: exact valid selection, else top four from due stack. */
export function resolveStackStartPlayerIds(
  stack: WinLoseStackState,
  selectedIds: string[]
): string[] | null {
  const dueIds = getNextUpStackIds(stack);
  if (dueIds.length < WIN_LOSE_STACK_PLAYERS) return null;

  if (
    selectedIds.length === WIN_LOSE_STACK_PLAYERS &&
    new Set(selectedIds).size === WIN_LOSE_STACK_PLAYERS &&
    selectedIds.every((id) => dueIds.includes(id))
  ) {
    const selectedSet = new Set(selectedIds);
    return dueIds.filter((id) => selectedSet.has(id));
  }

  return getDefaultStackSelection(stack);
}

/** Next due doubles lineup as [teamA1, teamA2, teamB1, teamB2] for display/sync. */
export function buildNextStackLineupPlayerIds(
  stack: WinLoseStackState,
  selectedIds: string[] = []
): string[] | null {
  const lineupIds = resolveStackStartPlayerIds(stack, selectedIds);
  if (!lineupIds) return null;
  return partnerSplitPairing(lineupIds, stack.lastPartnerByPlayer).playerIds;
}

/** Swap a player up or down within the Next-Up stack only. */
export function reorderPlayerInDueStack(
  state: QueueState,
  playerId: string,
  direction: 'up' | 'down'
): QueueState | null {
  const stack = ensureWinLoseStackState(state.winLoseStack);
  const field = stackFieldForSource(stack.nextUp);
  const current = field === 'winnerStack' ? stack.winnerStack : stack.loserStack;
  const index = current.indexOf(playerId);
  if (index < 0) return null;

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= current.length) return null;

  const next = [...current];
  [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];

  return {
    ...state,
    winLoseStack: setStackField(stack, field, next),
  };
}

/**
 * Session cold start: up to 4 players all in Winners; 5+ splits the check-in list
 * evenly between Winners and Losers (check-in order preserved within each pile).
 */
export function buildInitialStackDistribution(
  waitingPlayerIds: string[]
): Pick<WinLoseStackState, 'winnerStack' | 'loserStack' | 'nextUp'> {
  if (waitingPlayerIds.length <= WIN_LOSE_STACK_PLAYERS) {
    return {
      winnerStack: [...waitingPlayerIds],
      loserStack: [],
      nextUp: 'winners',
    };
  }

  const splitAt = Math.ceil(waitingPlayerIds.length / 2);
  return {
    winnerStack: waitingPlayerIds.slice(0, splitAt),
    loserStack: waitingPlayerIds.slice(splitAt),
    nextUp: 'winners',
  };
}

/** Fix sessions where every waiting player was piled into Winners only. */
export function rebalanceStackQueuesIfNeeded(stack: WinLoseStackState): WinLoseStackState {
  if (
    stack.loserStack.length === 0 &&
    stack.winnerStack.length > WIN_LOSE_STACK_PLAYERS
  ) {
    const distributed = buildInitialStackDistribution(stack.winnerStack);
    return {
      ...stack,
      winnerStack: distributed.winnerStack,
      loserStack: distributed.loserStack,
      // If Next-Up was stuck on an empty Losers pile, keep it on Losers now that it has players.
      nextUp:
        stack.nextUp === 'losers' && distributed.loserStack.length >= WIN_LOSE_STACK_PLAYERS
          ? 'losers'
          : distributed.nextUp,
    };
  }

  return stack;
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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

export interface StartNextStackMatchOptions {
  playerIds?: string[];
}

/** Pull four from Next-Up stack and create an active match on the given court. */
export function startNextStackMatch(
  state: QueueState,
  courtId: string,
  options?: StartNextStackMatchOptions
): StartStackMatchResult {
  let stack = ensureWinLoseStackState(state.winLoseStack);
  const sourceStack = stack.nextUp;
  const nextUpIds = getNextUpStackIds(stack);

  if (nextUpIds.length < WIN_LOSE_STACK_PLAYERS) {
    return { state, match: null, partnerConflict: false };
  }

  let pulled: string[];
  if (options?.playerIds) {
    const removed = removeSpecificPlayersFromDueStack(stack, options.playerIds);
    if (!removed) {
      return { state, match: null, partnerConflict: false };
    }
    stack = removed.stack;
    pulled = removed.pulled;
  } else {
    const result = removeFrontPlayers(stack, sourceStack, WIN_LOSE_STACK_PLAYERS);
    stack = result.stack;
    pulled = result.pulled;
  }

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

/** Append a checked-in player to the shorter waiting stack. */
export function seedPlayerToStack(state: QueueState, playerId: string): QueueState {
  let stack = ensureWinLoseStackState(state.winLoseStack);
  if (
    stack.winnerStack.includes(playerId) ||
    stack.loserStack.includes(playerId) ||
    state.activeMatches.some((match) => match.playerIds.includes(playerId))
  ) {
    return state;
  }

  if (stack.winnerStack.length === 0 && stack.loserStack.length === 0) {
    stack = appendToStack(stack, 'winnerStack', [playerId]);
    return { ...state, winLoseStack: stack };
  }

  const field =
    stack.winnerStack.length < stack.loserStack.length
      ? 'winnerStack'
      : stack.loserStack.length < stack.winnerStack.length
        ? 'loserStack'
        : 'loserStack';
  stack = appendToStack(stack, field, [playerId]);
  return { ...state, winLoseStack: stack };
}

/** @deprecated Use seedPlayerToStack */
export const seedPlayerToWinnersStack = seedPlayerToStack;

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
  // Starting the match flipped Next-Up; undo that when the match is cancelled.
  stack = flipNextUp(stack);

  return { ...state, winLoseStack: stack };
}

export function resetWinLoseStackState(state: QueueState): QueueState {
  return { ...state, winLoseStack: emptyWinLoseStackState() };
}

export function seedCheckedInPlayersToWinnersStack(
  state: QueueState,
  checkedInPlayerIds: string[]
): QueueState {
  const distributed = buildInitialStackDistribution(checkedInPlayerIds);
  return {
    ...state,
    winLoseStack: {
      ...emptyWinLoseStackState(),
      ...distributed,
    },
  };
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

/** Ensure every matchable checked-in player appears in a stack (e.g. after mode switch). */
export function reconcileStackWithCheckedInPlayers(
  state: QueueState,
  players: Player[]
): QueueState {
  const busy = new Set(state.activeMatches.flatMap((match) => match.playerIds));
  const stack = ensureWinLoseStackState(state.winLoseStack);

  const waitingInStack = dedupePreserveOrder([
    ...stack.winnerStack,
    ...stack.loserStack,
  ]).filter((id) => !busy.has(id));

  const inStack = new Set(waitingInStack);
  const missing = players
    .filter(isPlayerMatchable)
    .map((player) => player.id)
    .filter((id) => !inStack.has(id) && !busy.has(id));

  if (stack.loserStack.length === 0 && waitingInStack.length > WIN_LOSE_STACK_PLAYERS) {
    const allWaiting = dedupePreserveOrder([...waitingInStack, ...missing]);
    const distributed = buildInitialStackDistribution(allWaiting);
    return {
      ...state,
      winLoseStack: {
        ...stack,
        ...distributed,
        nextUp:
          stack.nextUp === 'losers' && distributed.loserStack.length >= WIN_LOSE_STACK_PLAYERS
            ? 'losers'
            : distributed.nextUp,
      },
    };
  }

  let next = state;
  for (const id of missing) {
    next = seedPlayerToStack(next, id);
  }
  return next;
}

export function getStackStartBlockReason(
  state: QueueState,
  openCourtCount: number,
  activeMatchCount: number
): string | null {
  const stack = state.winLoseStack;
  if (!stack) {
    return 'Stacks not initialized — check in at least 4 players on the Players tab.';
  }

  if (openCourtCount === 0 && activeMatchCount > 0) {
    return 'All courts are in use. Record a winner or cancel a match to free a court.';
  }

  if (openCourtCount === 0) {
    return 'No courts available. Add at least one court on the Courts tab.';
  }

  const nextUpCount = countNextUpStackFromStack(stack);
  if (nextUpCount >= WIN_LOSE_STACK_PLAYERS) {
    return null;
  }

  const nextLabel = stack.nextUp === 'winners' ? 'Winners' : 'Losers';
  const otherLabel = stack.nextUp === 'winners' ? 'Losers' : 'Winners';
  const otherCount =
    stack.nextUp === 'winners' ? stack.loserStack.length : stack.winnerStack.length;

  if (otherCount >= WIN_LOSE_STACK_PLAYERS) {
    return (
      `Next-Up is the ${nextLabel} stack (${nextUpCount}/4). ` +
      `${otherCount} players are in the ${otherLabel} waiting pile — ` +
      `complete games to move players into the ${nextLabel} stack, or refresh the Queue tab to rebalance piles.`
    );
  }

  const totalCheckedIn = stack.winnerStack.length + stack.loserStack.length;
  if (totalCheckedIn < WIN_LOSE_STACK_PLAYERS) {
    return `Need at least ${WIN_LOSE_STACK_PLAYERS} checked-in players. Currently ${totalCheckedIn} in stacks — check in more on the Players tab.`;
  }

  return `Need ${WIN_LOSE_STACK_PLAYERS} players in the ${nextLabel} stack (Next-Up). Currently ${nextUpCount}.`;
}
