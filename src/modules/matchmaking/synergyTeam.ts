import { QueueMatchMode } from '@/config/queue-match-modes';
import { splitTeams } from '@/lib/format-utils';
import { duprDoublesRating } from '@/modules/matchmaking/dupr-ratings';
import { AppSettings } from '@/types/app-data';
import { Player } from '@/types/player';

export type SynergyPair = [string, string];

export interface SynergyTeamConfig {
  enabled: boolean;
  pairs: SynergyPair[];
}

export const MAX_SYNERGY_PAIRS = 6;

export function normalizeSynergyPair(pair: SynergyPair): SynergyPair {
  return pair[0] <= pair[1] ? [pair[0], pair[1]] : [pair[1], pair[0]];
}

export function synergyPairKey(pair: SynergyPair): string {
  return normalizeSynergyPair(pair).join('|');
}

export function generateSynergyTeamName(nameA: string, nameB: string): string {
  return `${nameA} & ${nameB}`;
}

export function getSynergyTeamLabel(
  pair: SynergyPair,
  players: Player[],
  teamNames?: Record<string, string>
): string {
  const key = synergyPairKey(pair);
  const custom = teamNames?.[key]?.trim();
  if (custom) return custom;
  const nameA = players.find((player) => player.id === pair[0])?.name ?? 'Player';
  const nameB = players.find((player) => player.id === pair[1])?.name ?? 'Player';
  return generateSynergyTeamName(nameA, nameB);
}

export function pruneSynergyTeamNames(
  teamNames: Record<string, string>,
  pairs: SynergyPair[]
): Record<string, string> {
  const validKeys = new Set(pairs.map(synergyPairKey));
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(teamNames)) {
    if (validKeys.has(key)) next[key] = value;
  }
  return next;
}

export function getSynergyConfig(settings?: Pick<AppSettings, 'synergyTeamsEnabled' | 'synergyPairs'>): SynergyTeamConfig {
  const pairs = (settings?.synergyPairs ?? [])
    .filter((pair) => pair.length === 2 && pair[0] !== pair[1])
    .map((pair) => normalizeSynergyPair([pair[0]!, pair[1]!]));
  return {
    enabled: settings?.synergyTeamsEnabled === true,
    pairs,
  };
}

export function isSynergyActive(config: SynergyTeamConfig): boolean {
  return config.enabled && config.pairs.length > 0;
}

export function playerInSynergyPair(playerId: string, pairs: SynergyPair[]): SynergyPair | null {
  for (const pair of pairs) {
    if (pair[0] === playerId || pair[1] === playerId) return pair;
  }
  return null;
}

export function synergyPartnerId(playerId: string, pairs: SynergyPair[]): string | null {
  const pair = playerInSynergyPair(playerId, pairs);
  if (!pair) return null;
  return pair[0] === playerId ? pair[1] : pair[0];
}

export function validateSynergyPairForMode(
  playerA: Player,
  playerB: Player,
  matchMode: QueueMatchMode
): { ok: true } | { ok: false; message: string } {
  if (playerA.id === playerB.id) {
    return { ok: false, message: 'Pick two different players for a synergy pair.' };
  }

  if (matchMode === 'mixed_doubles') {
    if (playerA.gender === playerB.gender) {
      return {
        ok: false,
        message: 'Mixed doubles synergy pairs need one male and one female player.',
      };
    }
    return { ok: true };
  }

  if (matchMode === 'same_gender' && playerA.gender !== playerB.gender) {
    return {
      ok: false,
      message: 'Same-gender mode synergy pairs must be the same gender.',
    };
  }

  return { ok: true };
}

export function validateNewSynergyPair(
  playerA: Player,
  playerB: Player,
  existingPairs: SynergyPair[],
  matchMode: QueueMatchMode
): { ok: true; pair: SynergyPair } | { ok: false; message: string } {
  const modeCheck = validateSynergyPairForMode(playerA, playerB, matchMode);
  if (!modeCheck.ok) return modeCheck;

  if (existingPairs.length >= MAX_SYNERGY_PAIRS) {
    return { ok: false, message: `Maximum ${MAX_SYNERGY_PAIRS} synergy pairs per session.` };
  }

  if (playerInSynergyPair(playerA.id, existingPairs)) {
    return { ok: false, message: `${playerA.name} is already in a synergy pair.` };
  }
  if (playerInSynergyPair(playerB.id, existingPairs)) {
    return { ok: false, message: `${playerB.name} is already in a synergy pair.` };
  }

  return { ok: true, pair: normalizeSynergyPair([playerA.id, playerB.id]) };
}

export function pruneSynergyPairs(
  pairs: SynergyPair[],
  validPlayerIds: Set<string>
): SynergyPair[] {
  return pairs.filter(([a, b]) => validPlayerIds.has(a) && validPlayerIds.has(b));
}

export function pairsFullyInQuartet(
  quartetIds: string[],
  pairs: SynergyPair[]
): SynergyPair[] {
  const idSet = new Set(quartetIds);
  return pairs.filter(([a, b]) => idSet.has(a) && idSet.has(b));
}

/** Reject quartets that include one synergy partner while the other is still available. */
export function isQuartetSynergySelectionValid(
  quartetIds: string[],
  availableIds: Set<string>,
  pairs: SynergyPair[]
): boolean {
  if (pairs.length === 0) return true;

  const quartetSet = new Set(quartetIds);
  for (const [a, b] of pairs) {
    const aIn = quartetSet.has(a);
    const bIn = quartetSet.has(b);
    if (aIn === bIn) continue;

    const missingPartner = aIn ? b : a;
    if (availableIds.has(missingPartner)) return false;
  }

  return true;
}

export function isTeamSplitSynergyValid(
  team1: Player[],
  team2: Player[],
  activePairs: SynergyPair[]
): boolean {
  const allIds = new Set([...team1, ...team2].map((player) => player.id));
  const team1Ids = new Set(team1.map((player) => player.id));

  for (const [a, b] of activePairs) {
    const aIn = allIds.has(a);
    const bIn = allIds.has(b);
    if (!aIn || !bIn) continue;

    const aOnTeam1 = team1Ids.has(a);
    const bOnTeam1 = team1Ids.has(b);
    if (aOnTeam1 !== bOnTeam1) return false;
  }

  return true;
}

export function filterValidTeamSplits(
  splits: Array<[Player[], Player[]]>,
  activePairs: SynergyPair[]
): Array<[Player[], Player[]]> {
  if (activePairs.length === 0) return splits;
  return splits.filter(([team1, team2]) => isTeamSplitSynergyValid(team1, team2, activePairs));
}

function buildLineupFromTeams(teamA: Player[], teamB: Player[]): string[] {
  return [...teamA.map((p) => p.id), ...teamB.map((p) => p.id)];
}

/** Reorder a doubles lineup so active synergy pairs share a team when possible. */
export function applySynergyToManualLineup(
  playerIds: string[],
  players: Player[],
  config: SynergyTeamConfig
): string[] | null {
  if (!isSynergyActive(config) || playerIds.length !== 4) return playerIds;

  const byId = new Map(players.map((player) => [player.id, player]));
  const quartet = playerIds.map((id) => byId.get(id)).filter(Boolean) as Player[];
  if (quartet.length !== 4) return playerIds;

  const activePairs = pairsFullyInQuartet(playerIds, config.pairs);
  if (activePairs.length === 0) return playerIds;

  const byDupr = [...quartet].sort((a, b) => duprDoublesRating(a) - duprDoublesRating(b));
  const splits: Array<[Player[], Player[]]> = [
    [[byDupr[0]!, byDupr[1]!], [byDupr[2]!, byDupr[3]!]],
    [[byDupr[0]!, byDupr[2]!], [byDupr[1]!, byDupr[3]!]],
    [[byDupr[0]!, byDupr[3]!], [byDupr[1]!, byDupr[2]!]],
  ];

  const valid = filterValidTeamSplits(splits, activePairs);
  if (valid.length === 0) return null;

  const currentTeams = splitTeams(playerIds);
  const teamKey = (ids: string[]) => [...ids].sort().join('|');

  for (const [team1, team2] of valid) {
    const lineup = buildLineupFromTeams(team1, team2);
    const { teamA, teamB } = splitTeams(lineup);
    if (
      teamKey(teamA) === teamKey(currentTeams.teamA) &&
      teamKey(teamB) === teamKey(currentTeams.teamB)
    ) {
      return lineup;
    }
  }

  const [team1, team2] = valid[0]!;
  return buildLineupFromTeams(team1, team2);
}

export function wouldBreakSynergy(
  oldPlayerIds: string[],
  newPlayerIds: string[],
  config: SynergyTeamConfig
): boolean {
  if (!isSynergyActive(config) || oldPlayerIds.length !== 4) return false;

  const byId = (ids: string[]) => new Set(ids);
  const oldSet = byId(oldPlayerIds);
  const activePairs = config.pairs.filter(([a, b]) => oldSet.has(a) && oldSet.has(b));
  if (activePairs.length === 0) return false;

  const newPlayers = newPlayerIds.filter((id) => oldSet.has(id));
  if (newPlayers.length < 2) return false;

  const tempPlayers: Player[] = newPlayerIds.map(
    (id, index) =>
      ({
        id,
        name: id,
        gender: 'male',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        checkedIn: true,
        excluded: false,
        dupr: { duprConnected: false, duprRatingSource: 'manual', duprDoublesRating: index },
      }) as Player
  );

  const { teamA, teamB } = splitTeams(newPlayerIds);
  const team1 = teamA.map((id) => tempPlayers.find((p) => p.id === id)!);
  const team2 = teamB.map((id) => tempPlayers.find((p) => p.id === id)!);

  return !isTeamSplitSynergyValid(team1, team2, activePairs);
}
