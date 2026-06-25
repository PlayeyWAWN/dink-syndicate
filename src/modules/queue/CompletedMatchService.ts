import { winnerIdsForTeam, winningTeamForMatch } from '@/lib/format-utils';
import { matchService } from '@/modules/match/MatchService';
import { validateEntryGenderRules } from '@/modules/queue/ManualMatchService';
import { Player } from '@/types/player';
import { Match, QueueState } from '@/types/queue';

export const RECENT_COMPLETED_MATCHES_PAGE_SIZE = 5;

export interface CompletedMatchUpdate {
  playerIds: string[];
  winningTeam: 'A' | 'B';
  correctionNote?: string;
}

function samePlayerIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function sameWinners(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((id) => setA.has(id));
}

/** Completed matches sorted newest first. */
export function sortCompletedMatchesNewestFirst(completedMatches: Match[]): Match[] {
  return [...completedMatches].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}

/** @deprecated Use sortCompletedMatchesNewestFirst with client pagination. */
export function getRecentCompletedMatches(
  completedMatches: Match[],
  limit = RECENT_COMPLETED_MATCHES_PAGE_SIZE
): Match[] {
  return sortCompletedMatchesNewestFirst(completedMatches).slice(0, limit);
}

export function swapCompletedMatchPlayerIds(
  playerIds: string[],
  playerIdA: string,
  playerIdB: string
): string[] | null {
  if (playerIdA === playerIdB) return null;

  const idxA = playerIds.indexOf(playerIdA);
  const idxB = playerIds.indexOf(playerIdB);
  if (idxA === -1 || idxB === -1) return null;

  const nextIds = [...playerIds];
  nextIds[idxA] = playerIdB;
  nextIds[idxB] = playerIdA;
  return nextIds;
}

export function replaceCompletedMatchPlayerId(
  playerIds: string[],
  oldPlayerId: string,
  newPlayerId: string
): string[] | null {
  if (oldPlayerId === newPlayerId) return null;
  if (!playerIds.includes(oldPlayerId)) return null;
  if (playerIds.includes(newPlayerId)) return null;

  return playerIds.map((id) => (id === oldPlayerId ? newPlayerId : id));
}

/** Apply a correction to a completed match and reconcile player stats. */
export function applyCompletedMatchCorrection(
  queueState: QueueState,
  players: Player[],
  matchId: string,
  update: CompletedMatchUpdate
): { queueState: QueueState; players: Player[] } | null {
  const index = queueState.completedMatches.findIndex((match) => match.id === matchId);
  if (index === -1) return null;

  const existing = queueState.completedMatches[index];
  const winnerPlayerIds = winnerIdsForTeam(update.playerIds, update.winningTeam);
  if (winnerPlayerIds.length === 0) return null;

  if (!validateEntryGenderRules(existing.format, update.playerIds, players)) {
    return null;
  }

  const trimmedNote = update.correctionNote?.trim();
  const nextMatch: Match = {
    ...existing,
    playerIds: update.playerIds,
    winnerPlayerIds,
    correctionNote: trimmedNote || undefined,
    correctedAt: Date.now(),
  };

  const statsChanged =
    !samePlayerIds(existing.playerIds, update.playerIds) ||
    !sameWinners(existing.winnerPlayerIds, winnerPlayerIds);

  let nextPlayers = players;
  if (statsChanged) {
    nextPlayers = matchService.revertStats(nextPlayers, existing);
    nextPlayers = matchService.applyStats(nextPlayers, nextMatch);
  }

  const completedMatches = [...queueState.completedMatches];
  completedMatches[index] = nextMatch;

  return {
    queueState: { ...queueState, completedMatches },
    players: nextPlayers,
  };
}

export { winningTeamForMatch };
