import { AppData } from '@/types/app-data';
import { Player } from '@/types/player';
import {
  defaultArchiveName,
  SessionArchive,
  SessionPlayerStats,
} from '@/types/session-archive';

export function buildSessionArchive(data: AppData, name: string, endedAt = Date.now()): SessionArchive {
  const startedAt = data.settings?.sessionStartTime ?? endedAt;
  const playerStats: SessionPlayerStats[] = data.players
    .filter((player) => player.gamesPlayed > 0)
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
    }));

  return {
    id: `archive-${endedAt}`,
    name: name.trim() || defaultArchiveName(new Date(endedAt)),
    startedAt,
    endedAt,
    matchesCompleted: data.queueState.completedMatches.length,
    playerStats,
  };
}

export function hasSessionActivity(data: AppData): boolean {
  if (data.queueState.completedMatches.length > 0) return true;
  if (data.queueState.activeMatches.length > 0) return true;
  if (data.queueState.queue.length > 0) return true;
  return data.players.some((player) => player.gamesPlayed > 0);
}

export function resetSessionStatsForPlayers(players: Player[]): Player[] {
  const now = Date.now();
  return players.map((player) => ({
    ...player,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    availableSince: player.checkedIn && !player.excluded ? now : undefined,
    updatedAt: now,
  }));
}
