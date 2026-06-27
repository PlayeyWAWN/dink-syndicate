import { CourtFormat, QueueMatchMode } from '@/config/queue-match-modes';
import { splitTeams } from '@/lib/format-utils';
import {
  balanceDoublesTeamsBySplit,
  balanceMixedDoublesTeams,
  isDuprMatchBalanced,
  isSinglesPairBalanced,
  teamAvgDupr,
} from '@/modules/matchmaking/DuprBalance';
import {
  applySynergyToManualLineup,
  getSynergyConfig,
  isSynergyActive,
  SynergyTeamConfig,
} from '@/modules/matchmaking/synergyTeam';
import { AppSettings } from '@/types/app-data';
import { Player } from '@/types/player';
import { QueueEntry } from '@/types/queue';

export interface ManualMatchValidation {
  ok: true;
  format: QueueEntry['format'];
  playerIds: string[];
}

export interface ManualMatchValidationError {
  ok: false;
  message: string;
}

export type ManualMatchResult = ManualMatchValidation | ManualMatchValidationError;

export interface BalanceAssessment {
  balanced: boolean;
  summary: string;
  team1Avg: number;
  team2Avg: number;
}

/** Resolve queue entry format and ordered playerIds for a manual selection. */
export function buildManualMatch(
  courtFormat: CourtFormat,
  matchMode: QueueMatchMode,
  selected: Player[],
  settings?: Pick<AppSettings, 'synergyTeamsEnabled' | 'synergyPairs'>
): ManualMatchResult {
  if (courtFormat === 'singles') {
    if (selected.length !== 2) {
      return { ok: false, message: 'Select exactly 2 players for singles.' };
    }
    return {
      ok: true,
      format: 'singles',
      playerIds: selected.map((player) => player.id),
    };
  }

  if (selected.length !== 4) {
    return { ok: false, message: 'Select exactly 4 players for doubles.' };
  }

  if (matchMode === 'mixed_doubles') {
    const males = selected.filter((player) => player.gender === 'male').length;
    const females = selected.filter((player) => player.gender === 'female').length;
    if (males !== 2 || females !== 2) {
      return { ok: false, message: 'Mixed doubles needs 2 males and 2 females in your selection.' };
    }
    return finalizeDoublesManualMatch(
      balanceMixedDoublesTeams(selected),
      selected,
      'mixed_doubles',
      getSynergyConfig(settings)
    );
  }

  if (matchMode === 'same_gender') {
    const allMale = selected.every((player) => player.gender === 'male');
    const allFemale = selected.every((player) => player.gender === 'female');
    if (!allMale && !allFemale) {
      return {
        ok: false,
        message: 'Same-gender doubles needs 4 players of the same gender.',
      };
    }
    return finalizeDoublesManualMatch(
      balanceDoublesTeamsBySplit(selected),
      selected,
      'same_gender_doubles',
      getSynergyConfig(settings)
    );
  }

  return finalizeDoublesManualMatch(
    balanceDoublesTeamsBySplit(selected),
    selected,
    'doubles',
    getSynergyConfig(settings)
  );
}

function finalizeDoublesManualMatch(
  playerIds: string[],
  selected: Player[],
  format: QueueEntry['format'],
  synergy: SynergyTeamConfig
): ManualMatchResult {
  if (!isSynergyActive(synergy)) {
    return { ok: true, format, playerIds };
  }

  const adjusted = applySynergyToManualLineup(playerIds, selected, synergy);
  if (!adjusted) {
    return {
      ok: false,
      message: 'Synergy pairs cannot be partnered together in this selection.',
    };
  }

  return { ok: true, format, playerIds: adjusted };
}

/** Check whether ordered playerIds satisfy gender rules for the entry format. */
export function validateEntryGenderRules(
  format: QueueEntry['format'],
  playerIds: string[],
  players: Player[]
): boolean {
  const byId = new Map(players.map((player) => [player.id, player]));
  const resolved = playerIds.map((id) => byId.get(id)).filter(Boolean) as Player[];
  if (resolved.length !== playerIds.length) return false;

  if (format === 'mixed_doubles') {
    const { teamA, teamB } = splitTeams(playerIds);
    for (const teamIds of [teamA, teamB]) {
      const team = teamIds.map((id) => byId.get(id)!);
      if (team.length !== 2) return false;
      const males = team.filter((player) => player.gender === 'male').length;
      if (males !== 1) return false;
    }
    return true;
  }

  if (format === 'same_gender_doubles') {
    const genders = new Set(resolved.map((player) => player.gender));
    return genders.size === 1;
  }

  return true;
}

/** Assess DUPR balance for a queued match lineup. */
export function assessMatchBalance(
  format: QueueEntry['format'],
  playerIds: string[],
  players: Player[]
): BalanceAssessment {
  const byId = new Map(players.map((player) => [player.id, player]));
  const { teamA, teamB } = splitTeams(playerIds);
  const team1 = teamA.map((id) => byId.get(id)!);
  const team2 = teamB.map((id) => byId.get(id)!);
  const team1Avg = team1.length ? teamAvgDupr(team1) : 0;
  const team2Avg = team2.length ? teamAvgDupr(team2) : 0;

  if (format === 'singles') {
    const balanced = isSinglesPairBalanced(team1[0], team2[0]);
    return {
      balanced,
      team1Avg,
      team2Avg,
      summary: balanced
        ? 'Singles pair is skill-balanced by DUPR.'
        : 'Singles pair exceeds the allowed DUPR gap.',
    };
  }

  const balanced = isDuprMatchBalanced(team1, team2);
  return {
    balanced,
    team1Avg,
    team2Avg,
    summary: balanced
      ? 'Teams are skill-balanced by DUPR.'
      : 'Teams exceed DUPR balance limits (rating gap, team average, or overall span).',
  };
}

/** Available players eligible to replace a slot in a queued match. */
export function filterReplacementCandidates(
  format: QueueEntry['format'],
  player: Player,
  available: Player[]
): Player[] {
  if (format === 'mixed_doubles' || format === 'same_gender_doubles') {
    return available.filter((candidate) => candidate.gender === player.gender);
  }
  return available;
}

/** Standby players with the longest wait first (oldest availableSince at top). */
export function sortAvailableByLongestWait(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const sinceA = a.availableSince ?? Number.MAX_SAFE_INTEGER;
    const sinceB = b.availableSince ?? Number.MAX_SAFE_INTEGER;
    return sinceA - sinceB;
  });
}

/** Opponent team player ids for a player in a queued match. */
export function opponentPlayerIds(playerIds: string[], playerId: string): string[] {
  const { teamA, teamB } = splitTeams(playerIds);
  if (teamA.includes(playerId)) return teamB;
  if (teamB.includes(playerId)) return teamA;
  return [];
}

/** Partner id on the same team (doubles only). */
export function partnerPlayerId(playerIds: string[], playerId: string): string | null {
  const { teamA, teamB } = splitTeams(playerIds);
  if (teamA.includes(playerId) && teamA.length === 2) {
    return teamA.find((id) => id !== playerId) ?? null;
  }
  if (teamB.includes(playerId) && teamB.length === 2) {
    return teamB.find((id) => id !== playerId) ?? null;
  }
  return null;
}
