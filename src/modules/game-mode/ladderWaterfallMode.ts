import { createId } from '@/modules/matchmaking/create-id';
import { winnerIdsForTeam } from '@/lib/format-utils';
import { duprDoublesRating } from '@/modules/matchmaking/dupr-ratings';
import {
  clearLastPartnersForPlayers,
  partnerSplitPairing,
  updateLastPartners,
} from '@/modules/game-mode/partnerSplit';
import { Court } from '@/types/court';
import {
  ensureLadderWaterfallState,
  emptyLadderWaterfallState,
  LadderWaterfallState,
} from '@/types/ladder-waterfall';
import { Match, QueueState } from '@/types/queue';
import { isPlayerMatchable, Player } from '@/types/player';

export const LADDER_PLAYERS_PER_COURT = 4;

export function getCourtRank(courts: Court[], courtId: string): number {
  return courts.findIndex((court) => court.id === courtId);
}

export function courtIdAtRank(courts: Court[], rank: number): string | undefined {
  return courts[rank]?.id;
}

function emptyBenchesForCourts(courts: Court[]): Record<string, string[]> {
  const benchByCourtId: Record<string, string[]> = {};
  for (const court of courts) {
    benchByCourtId[court.id] = [];
  }
  return benchByCourtId;
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function sortPlayerIdsByDuprDesc(playerIds: string[], players: Player[]): string[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  return [...playerIds].sort(
    (a, b) => duprDoublesRating(byId.get(b)!) - duprDoublesRating(byId.get(a)!)
  );
}

export function getLadderPlayerIds(state: QueueState): Set<string> {
  const ladder = state.ladderWaterfall;
  if (!ladder) return new Set();

  const onBenches = Object.values(ladder.benchByCourtId).flat();
  return new Set([...onBenches, ...ladder.waitingPool]);
}

function appendToBench(
  ladder: LadderWaterfallState,
  courtId: string,
  ids: string[]
): LadderWaterfallState {
  const current = ladder.benchByCourtId[courtId] ?? [];
  return {
    ...ladder,
    benchByCourtId: {
      ...ladder.benchByCourtId,
      [courtId]: dedupePreserveOrder([...current, ...ids]),
    },
  };
}

function prependToBench(
  ladder: LadderWaterfallState,
  courtId: string,
  ids: string[]
): LadderWaterfallState {
  const current = ladder.benchByCourtId[courtId] ?? [];
  return {
    ...ladder,
    benchByCourtId: {
      ...ladder.benchByCourtId,
      [courtId]: dedupePreserveOrder([...ids, ...current]),
    },
  };
}

function removeFromLadder(ladder: LadderWaterfallState, playerId: string): LadderWaterfallState {
  const benchByCourtId: Record<string, string[]> = {};
  for (const [courtId, bench] of Object.entries(ladder.benchByCourtId)) {
    benchByCourtId[courtId] = bench.filter((id) => id !== playerId);
  }
  return {
    ...ladder,
    benchByCourtId,
    waitingPool: ladder.waitingPool.filter((id) => id !== playerId),
  };
}

function pullFromBench(
  ladder: LadderWaterfallState,
  courtId: string,
  count: number
): { ladder: LadderWaterfallState; pulled: string[] } {
  const current = ladder.benchByCourtId[courtId] ?? [];
  const pulled = current.slice(0, count);
  return {
    ladder: {
      ...ladder,
      benchByCourtId: {
        ...ladder.benchByCourtId,
        [courtId]: current.slice(count),
      },
    },
    pulled,
  };
}

/** DUPR-desc sort → fill Court 1 first, 4 per court → remainder to waiting pool. */
export function buildInitialLadderSeeding(
  playerIds: string[],
  courts: Court[],
  players: Player[]
): Pick<LadderWaterfallState, 'benchByCourtId' | 'waitingPool'> {
  const benchByCourtId = emptyBenchesForCourts(courts);
  const sorted = sortPlayerIdsByDuprDesc(playerIds, players);
  let index = 0;

  for (const court of courts) {
    const slice = sorted.slice(index, index + LADDER_PLAYERS_PER_COURT);
    benchByCourtId[court.id] = slice;
    index += LADDER_PLAYERS_PER_COURT;
    if (index >= sorted.length) break;
  }

  return {
    benchByCourtId,
    waitingPool: sorted.slice(index),
  };
}

export function resetLadderWaterfallState(state: QueueState): QueueState {
  return { ...state, ladderWaterfall: emptyLadderWaterfallState() };
}

export function seedCheckedInPlayersToLadder(
  state: QueueState,
  checkedInPlayerIds: string[],
  courts: Court[],
  players: Player[]
): QueueState {
  const seeded = buildInitialLadderSeeding(checkedInPlayerIds, courts, players);
  return {
    ...state,
    ladderWaterfall: {
      ...emptyLadderWaterfallState(),
      ...seeded,
    },
  };
}

/** Route winners up and losers down after a ladder match completes. */
export function routePlayersAfterLadderMatch(
  state: QueueState,
  match: Pick<Match, 'playerIds' | 'ladderMeta'>,
  winningTeam: 'A' | 'B',
  courts: Court[]
): QueueState {
  if (!match.ladderMeta) return state;

  const winnerIds = winnerIdsForTeam(match.playerIds, winningTeam);
  const winnerSet = new Set(winnerIds);
  const loserIds = match.playerIds.filter((id) => !winnerSet.has(id));

  const rank = match.ladderMeta.courtRank;
  const lastRank = courts.length - 1;
  const winnerTargetRank = Math.max(rank - 1, 0);
  const loserTargetRank = Math.min(rank + 1, lastRank);

  const winnerCourtId = courtIdAtRank(courts, winnerTargetRank);
  const loserCourtId = courtIdAtRank(courts, loserTargetRank);
  if (!winnerCourtId || !loserCourtId) return state;

  let ladder = ensureLadderWaterfallState(state.ladderWaterfall);
  ladder = appendToBench(ladder, winnerCourtId, winnerIds);
  ladder = appendToBench(ladder, loserCourtId, loserIds);

  return { ...state, ladderWaterfall: ladder };
}

export interface StartLadderMatchResult {
  state: QueueState;
  match: Match | null;
  partnerConflict: boolean;
}

export function countBenchPlayers(ladder: LadderWaterfallState, courtId: string): number {
  return (ladder.benchByCourtId[courtId] ?? []).length;
}

export function canStartLadderMatchOnCourt(state: QueueState, courtId: string): boolean {
  const ladder = state.ladderWaterfall;
  if (!ladder) return false;
  return countBenchPlayers(ladder, courtId) >= LADDER_PLAYERS_PER_COURT;
}

/** Pull four from a court bench and create an active match. */
export function startLadderMatchOnCourt(
  state: QueueState,
  courtId: string,
  courts: Court[]
): StartLadderMatchResult {
  let ladder = ensureLadderWaterfallState(state.ladderWaterfall);
  const courtRank = getCourtRank(courts, courtId);
  if (courtRank < 0) {
    return { state, match: null, partnerConflict: false };
  }

  if (countBenchPlayers(ladder, courtId) < LADDER_PLAYERS_PER_COURT) {
    return { state, match: null, partnerConflict: false };
  }

  const { ladder: afterPull, pulled } = pullFromBench(
    ladder,
    courtId,
    LADDER_PLAYERS_PER_COURT
  );
  ladder = afterPull;

  const { playerIds, hadPartnerConflict } = partnerSplitPairing(
    pulled,
    ladder.lastPartnerByPlayer
  );
  ladder = {
    ...ladder,
    lastPartnerByPlayer: updateLastPartners(playerIds, ladder.lastPartnerByPlayer),
  };

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
    ladderMeta: {
      courtId,
      courtRank,
      benchPullOrder: pulled,
    },
  };

  return {
    state: {
      ...state,
      ladderWaterfall: ladder,
      activeMatches: [...state.activeMatches, match],
    },
    match,
    partnerConflict: hadPartnerConflict,
  };
}

export function tryStartReadyLadderMatches(
  state: QueueState,
  courts: Court[],
  preferredCourtId?: string
): { state: QueueState; matches: Match[] } {
  let nextState = state;
  const matches: Match[] = [];
  const busyCourtIds = new Set(nextState.activeMatches.map((m) => m.courtId).filter(Boolean));

  const order = preferredCourtId
    ? [
        ...courts.filter((c) => c.id === preferredCourtId),
        ...courts.filter((c) => c.id !== preferredCourtId),
      ]
    : courts;

  for (const court of order) {
    if (busyCourtIds.has(court.id)) continue;
    if (!canStartLadderMatchOnCourt(nextState, court.id)) continue;

    const { state: afterStart, match } = startLadderMatchOnCourt(nextState, court.id, courts);
    if (!match) continue;

    nextState = afterStart;
    matches.push(match);
    busyCourtIds.add(court.id);
  }

  return { state: nextState, matches };
}

function findBestCourtForPlayer(
  ladder: LadderWaterfallState,
  courts: Court[],
  player: Player
): string | 'pool' {
  const rating = duprDoublesRating(player);
  let bestCourtId: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const court of courts) {
    const bench = ladder.benchByCourtId[court.id] ?? [];
    if (bench.length >= LADDER_PLAYERS_PER_COURT) continue;

    const rank = getCourtRank(courts, court.id);
    const idealRating = courts.length <= 1 ? rating : rating - rank * 0.25;
    const score = -Math.abs(rating - idealRating) - bench.length * 0.01;
    if (score > bestScore) {
      bestScore = score;
      bestCourtId = court.id;
    }
  }

  return bestCourtId ?? 'pool';
}

/** Append a checked-in player to the best-fit bench or waiting pool. */
export function seedPlayerToLadder(
  state: QueueState,
  playerId: string,
  courts: Court[],
  players: Player[]
): QueueState {
  let ladder = ensureLadderWaterfallState(state.ladderWaterfall);
  const player = players.find((p) => p.id === playerId);
  if (!player || !isPlayerMatchable(player)) return state;

  if (
    getLadderPlayerIds(state).has(playerId) ||
    state.activeMatches.some((match) => match.playerIds.includes(playerId))
  ) {
    return state;
  }

  if (courts.length === 0) {
    ladder = { ...ladder, waitingPool: dedupePreserveOrder([...ladder.waitingPool, playerId]) };
    return { ...state, ladderWaterfall: ladder };
  }

  if (Object.keys(ladder.benchByCourtId).length === 0) {
    ladder = {
      ...ladder,
      benchByCourtId: emptyBenchesForCourts(courts),
    };
  }

  const target = findBestCourtForPlayer(ladder, courts, player);
  if (target === 'pool') {
    ladder = { ...ladder, waitingPool: dedupePreserveOrder([...ladder.waitingPool, playerId]) };
  } else {
    ladder = appendToBench(ladder, target, [playerId]);
  }

  return { ...state, ladderWaterfall: ladder };
}

export function removePlayerFromLadder(state: QueueState, playerId: string): QueueState {
  if (!state.ladderWaterfall) return state;
  return {
    ...state,
    ladderWaterfall: removeFromLadder(state.ladderWaterfall, playerId),
  };
}

/** Return a cancelled ladder match's players to the front of the source bench. */
export function returnLadderMatchToBench(
  state: QueueState,
  match: Pick<Match, 'playerIds' | 'ladderMeta'>
): QueueState {
  if (!match.ladderMeta) return state;

  let ladder = ensureLadderWaterfallState(state.ladderWaterfall);
  ladder = prependToBench(ladder, match.ladderMeta.courtId, match.ladderMeta.benchPullOrder);
  ladder = {
    ...ladder,
    lastPartnerByPlayer: clearLastPartnersForPlayers(match.playerIds, ladder.lastPartnerByPlayer),
  };

  return { ...state, ladderWaterfall: ladder };
}

/** Ensure every matchable checked-in player is on a bench or in the pool. */
export function reconcileLadderWithCheckedInPlayers(
  state: QueueState,
  players: Player[],
  courts: Court[]
): QueueState {
  const busy = new Set(state.activeMatches.flatMap((match) => match.playerIds));
  let ladder = ensureLadderWaterfallState(state.ladderWaterfall);

  if (courts.length > 0 && Object.keys(ladder.benchByCourtId).length === 0) {
    ladder = { ...ladder, benchByCourtId: emptyBenchesForCourts(courts) };
  }

  const onLadder = dedupePreserveOrder([
    ...Object.values(ladder.benchByCourtId).flat(),
    ...ladder.waitingPool,
  ]).filter((id) => !busy.has(id));

  const inLadder = new Set(onLadder);
  const missing = players
    .filter(isPlayerMatchable)
    .map((player) => player.id)
    .filter((id) => !inLadder.has(id) && !busy.has(id));

  let next = state;
  for (const id of missing) {
    next = seedPlayerToLadder(next, id, courts, players);
  }
  return next;
}

export function getLadderStartBlockReason(
  state: QueueState,
  courts: Court[],
  activeMatchCount: number
): string | null {
  const ladder = state.ladderWaterfall;
  if (!ladder) {
    return 'Ladder not initialized — check in at least 4 players on the Players tab.';
  }

  if (courts.length === 0) {
    return 'No courts available. Add at least one court on the Courts tab.';
  }

  const readyCourts = courts.filter(
    (court) =>
      !state.activeMatches.some((match) => match.courtId === court.id) &&
      countBenchPlayers(ladder, court.id) >= LADDER_PLAYERS_PER_COURT
  );

  if (readyCourts.length > 0) {
    return null;
  }

  if (activeMatchCount > 0 && courts.every((court) => state.activeMatches.some((m) => m.courtId === court.id))) {
    return 'All courts are in use. Record a winner or cancel a match to free a court.';
  }

  const totalOnBenches = Object.values(ladder.benchByCourtId).reduce(
    (sum, bench) => sum + bench.length,
    0
  );
  const totalWaiting = totalOnBenches + ladder.waitingPool.length;

  if (totalWaiting < LADDER_PLAYERS_PER_COURT) {
    return `Need at least ${LADDER_PLAYERS_PER_COURT} checked-in players. Currently ${totalWaiting} on the ladder — check in more on the Players tab.`;
  }

  const largestBench = Math.max(
    0,
    ...courts.map((court) => countBenchPlayers(ladder, court.id))
  );

  return (
    `No court has ${LADDER_PLAYERS_PER_COURT} players on its bench yet (largest bench: ${largestBench}). ` +
    'Record completed games to move players between courts, or wait for more check-ins.'
  );
}

export function countTotalLadderWaiting(state: QueueState): number {
  const ladder = state.ladderWaterfall;
  if (!ladder) return 0;
  const onBenches = Object.values(ladder.benchByCourtId).reduce(
    (sum, bench) => sum + bench.length,
    0
  );
  return onBenches + ladder.waitingPool.length;
}
