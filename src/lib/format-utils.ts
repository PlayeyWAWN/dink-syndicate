import { Player } from '@/types/player';
import { Match, QueueEntry } from '@/types/queue';

/** Split playerIds into team A (first half) and team B (second half). */
export function splitTeams(playerIds: string[]): { teamA: string[]; teamB: string[] } {
  const mid = Math.ceil(playerIds.length / 2);
  return {
    teamA: playerIds.slice(0, mid),
    teamB: playerIds.slice(mid),
  };
}

export function formatTeamLabel(
  playerIds: string[],
  players: Player[],
  team: 'A' | 'B'
): string {
  const { teamA, teamB } = splitTeams(playerIds);
  const ids = team === 'A' ? teamA : teamB;
  const names = ids.map((id) => players.find((p) => p.id === id)?.name ?? 'Unknown');
  return names.join(' & ');
}

export function teamAvgGames(
  playerIds: string[],
  players: Player[],
  team: 'A' | 'B'
): number {
  const { teamA, teamB } = splitTeams(playerIds);
  const ids = team === 'A' ? teamA : teamB;
  if (ids.length === 0) return 0;
  const total = ids.reduce(
    (sum, id) => sum + (players.find((p) => p.id === id)?.gamesPlayed ?? 0),
    0
  );
  return total / ids.length;
}

export function winnerIdsForTeam(
  playerIds: string[],
  team: 'A' | 'B'
): string[] {
  const { teamA, teamB } = splitTeams(playerIds);
  return team === 'A' ? teamA : teamB;
}

/** Which team won a completed match, or null if unknown or split winners. */
export function winningTeamForMatch(match: Pick<Match, 'playerIds' | 'winnerPlayerIds'>): 'A' | 'B' | null {
  const winners = new Set(match.winnerPlayerIds);
  if (winners.size === 0) return null;

  const { teamA, teamB } = splitTeams(match.playerIds);
  if (teamA.length > 0 && teamA.every((id) => winners.has(id))) return 'A';
  if (teamB.length > 0 && teamB.every((id) => winners.has(id))) return 'B';
  return null;
}

export function queueEntryLabel(entry: QueueEntry, players: Player[]): string {
  const formatLabels: Record<QueueEntry['format'], string> = {
    singles: 'Singles',
    doubles: 'Doubles',
    mixed_doubles: 'Mixed (1M+1F)',
    same_gender_doubles: 'Same Gender',
  };
  const format = formatLabels[entry.format] ?? 'Match';
  const names = entry.playerIds
    .map((id) => players.find((p) => p.id === id)?.name ?? '?')
    .join(', ');
  return `${format}: ${names}`;
}

export function matchLabel(match: Match, players: Player[]): string {
  const { teamA, teamB } = splitTeams(match.playerIds);
  const a = teamA.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(' & ');
  const b = teamB.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(' & ');
  return `${a} vs ${b}`;
}

export function winRate(wins: number, gamesPlayed: number): string {
  if (gamesPlayed === 0) return '—';
  return `${Math.round((wins / gamesPlayed) * 100)}%`;
}

export function clampDuprRating(value: number): number {
  return Math.max(0, Math.min(8, Math.round(value * 100) / 100));
}

export function formatDuprRating(value: number | undefined): string {
  return clampDuprRating(value ?? 0).toFixed(2);
}
