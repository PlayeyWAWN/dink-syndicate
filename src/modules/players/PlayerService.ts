import { createPlayer, isPlayerMatchable, Player, PlayerGender } from '@/types/player';
import { QueueEntry } from '@/types/queue';
import { getSkillLevelFromDupr } from '@/lib/skill-utils';
import type { PlayerGenderFilter, PlayerSortField, PlayerStatusFilter } from '@/stores/playersUiStore';
import {
  generateTestRoster,
  GenerateTestRosterOptions,
  mergeTestRoster,
  MergeTestRosterResult,
} from '@/modules/players/generateTestRoster';

function createId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface BulkAddResult {
  players: Player[];
  added: number;
  skipped: string[];
}

export interface PlayerListFilters {
  search?: string;
  gender?: PlayerGenderFilter;
  status?: PlayerStatusFilter;
}

/** Player roster CRUD — pure logic, no DOM. */
export class PlayerService {
  addPlayer(
    players: Player[],
    name: string,
    duprDoublesRating?: number,
    gender?: PlayerGender
  ): Player[] {
    const trimmed = name.trim();
    if (!trimmed) return players;
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A player with that name already exists');
    }
    return [
      ...players,
      createPlayer({ id: createId(), name: trimmed, duprDoublesRating, gender }),
    ];
  }

  bulkAddPlayers(
    players: Player[],
    names: string[],
    duprDoublesRating: number,
    gender: PlayerGender
  ): BulkAddResult {
    let next = [...players];
    const skipped: string[] = [];
    let added = 0;

    for (const rawName of names) {
      const trimmed = rawName.trim();
      if (!trimmed) continue;
      if (next.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
        skipped.push(trimmed);
        continue;
      }
      next = [
        ...next,
        createPlayer({ id: createId(), name: trimmed, duprDoublesRating, gender }),
      ];
      added += 1;
    }

    return { players: next, added, skipped };
  }

  /** Append dummy players for local matchmaking perf testing. */
  addTestRoster(players: Player[], options: GenerateTestRosterOptions = {}): MergeTestRosterResult {
    const generated = generateTestRoster(options);
    return mergeTestRoster(players, generated);
  }

  updatePlayer(
    players: Player[],
    playerId: string,
    input: { name?: string; gender?: PlayerGender; duprDoublesRating?: number }
  ): Player[] {
    const now = Date.now();
    const trimmedName = input.name?.trim();
    if (trimmedName) {
      const conflict = players.find(
        (p) => p.id !== playerId && p.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (conflict) throw new Error('A player with that name already exists');
    }

    return players.map((p) => {
      if (p.id !== playerId) return p;
      return {
        ...p,
        name: trimmedName ?? p.name,
        gender: input.gender ?? p.gender,
        updatedAt: now,
        dupr: {
          ...p.dupr,
          duprDoublesRating: input.duprDoublesRating ?? p.dupr.duprDoublesRating,
          duprRatingSource: 'manual' as const,
          duprConnected: false,
        },
      };
    });
  }

  removePlayer(players: Player[], playerId: string): Player[] {
    return players.filter((p) => p.id !== playerId);
  }

  toggleCheckIn(players: Player[], playerId: string): Player[] {
    const now = Date.now();
    return players.map((p) => {
      if (p.id !== playerId) return p;
      const checkedIn = !p.checkedIn;
      return {
        ...p,
        checkedIn,
        checkedInAt: checkedIn ? now : undefined,
        availableSince: checkedIn ? now : undefined,
        pausedUntil: checkedIn ? p.pausedUntil : undefined,
        updatedAt: now,
        excluded: p.checkedIn ? p.excluded : false,
      };
    });
  }

  setExcluded(players: Player[], playerId: string, excluded: boolean): Player[] {
    const now = Date.now();
    return players.map((p) => {
      if (p.id !== playerId) return p;
      const checkedIn = excluded ? false : p.checkedIn;
      return {
        ...p,
        excluded,
        checkedIn,
        checkedInAt: checkedIn ? p.checkedInAt ?? now : undefined,
        availableSince: checkedIn && !excluded ? now : undefined,
        pausedUntil: excluded ? undefined : p.pausedUntil,
        updatedAt: now,
      };
    });
  }

  includeAllPlayers(players: Player[]): Player[] {
    const now = Date.now();
    return players.map((p) =>
      p.excluded
        ? {
            ...p,
            excluded: false,
            availableSince: p.checkedIn ? now : undefined,
            updatedAt: now,
          }
        : p
    );
  }

  /** Put a checked-in player on a timed break from matchmaking. */
  pausePlayer(players: Player[], playerId: string, durationMs: number, now = Date.now()): Player[] {
    return players.map((p) => {
      if (p.id !== playerId) return p;
      return {
        ...p,
        pausedUntil: now + durationMs,
        availableSince: undefined,
        updatedAt: now,
      };
    });
  }

  /** End a break early and return the player to the available pool. */
  returnFromBreak(players: Player[], playerId: string, now = Date.now()): Player[] {
    return players.map((p) => {
      if (p.id !== playerId) return p;
      const pausedUntil = undefined;
      const availableSince =
        p.checkedIn && !p.excluded ? now : undefined;
      return {
        ...p,
        pausedUntil,
        availableSince,
        updatedAt: now,
      };
    });
  }

  /** Clear expired break timers and restore availability. */
  clearExpiredPauses(players: Player[], now = Date.now()): Player[] {
    let changed = false;
    const next = players.map((p) => {
      if (p.pausedUntil == null || p.pausedUntil > now) return p;
      changed = true;
      return {
        ...p,
        pausedUntil: undefined,
        availableSince: p.checkedIn && !p.excluded ? now : undefined,
        updatedAt: now,
      };
    });
    return changed ? next : players;
  }

  /** Stamp or clear availability timers when queue/court status changes. */
  markPlayersAvailability(
    players: Player[],
    options: { available?: string[]; unavailable?: string[] },
    now = Date.now()
  ): Player[] {
    const available = new Set(options.available ?? []);
    const unavailable = new Set(options.unavailable ?? []);
    if (available.size === 0 && unavailable.size === 0) return players;

    return players.map((player) => {
      if (available.has(player.id)) {
        return { ...player, availableSince: now, updatedAt: now };
      }
      if (unavailable.has(player.id) && player.availableSince !== undefined) {
        return { ...player, availableSince: undefined, updatedAt: now };
      }
      return player;
    });
  }

  /** Restore standby timers when a queued match is cancelled. */
  restoreAvailableFromQueue(players: Player[], entry: QueueEntry, now = Date.now()): Player[] {
    const snapshot = entry.availableSinceByPlayer ?? {};
    const ids = new Set(entry.playerIds);
    return players.map((player) => {
      if (!ids.has(player.id)) return player;
      return {
        ...player,
        availableSince: snapshot[player.id] ?? player.availableSince ?? now,
        updatedAt: now,
      };
    });
  }

  /** Backfill missing timers for currently available players after hydrate. */
  syncAvailableSince(
    players: Player[],
    availablePlayerIds: Set<string>,
    now = Date.now()
  ): Player[] {
    return players.map((player) => {
      if (!availablePlayerIds.has(player.id)) {
        if (player.availableSince === undefined) return player;
        return { ...player, availableSince: undefined, updatedAt: now };
      }
      if (player.availableSince !== undefined) return player;
      return { ...player, availableSince: now, updatedAt: now };
    });
  }

  updateDuprRating(players: Player[], playerId: string, doublesRating: number): Player[] {
    const now = Date.now();
    return players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            updatedAt: now,
            dupr: {
              ...p.dupr,
              duprDoublesRating: doublesRating,
              duprRatingSource: 'manual' as const,
              duprConnected: false,
            },
          }
        : p
    );
  }

  getCheckedIn(players: Player[]): Player[] {
    return players.filter((p) => isPlayerMatchable(p));
  }

  filterPlayers(players: Player[], filters: PlayerListFilters): Player[] {
    const search = filters.search?.trim().toLowerCase() ?? '';
    return players.filter((player) => {
      if (search && !player.name.toLowerCase().includes(search)) return false;
      if (filters.gender && filters.gender !== 'all' && player.gender !== filters.gender) {
        return false;
      }
      if (filters.status === 'active' && (!player.checkedIn || player.excluded)) return false;
      if (filters.status === 'excluded' && !player.excluded) return false;
      if (filters.status === 'checked_out' && player.checkedIn) return false;
      return true;
    });
  }

  sortPlayers(players: Player[], sortBy: PlayerSortField, descending = false): Player[] {
    const sorted = [...players].sort((a, b) => {
      let result = 0;
      switch (sortBy) {
        case 'name':
          result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'gender':
          result = a.gender.localeCompare(b.gender);
          if (result === 0) result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'skill':
          result =
            (a.dupr.duprDoublesRating ?? 0) - (b.dupr.duprDoublesRating ?? 0);
          if (result === 0) result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'games':
          result = a.gamesPlayed - b.gamesPlayed;
          if (result === 0) result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'wins':
          result = a.wins - b.wins;
          if (result === 0) result = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
      }
      return descending ? -result : result;
    });
    return sorted;
  }

  /** For summary stats on the players tab. */
  getRosterStats(players: Player[]) {
    return {
      total: players.length,
      active: players.filter((p) => isPlayerMatchable(p)).length,
      checkedOut: players.filter((p) => !p.checkedIn && !p.excluded).length,
      excluded: players.filter((p) => p.excluded).length,
      male: players.filter((p) => p.gender === 'male').length,
      female: players.filter((p) => p.gender === 'female').length,
    };
  }

  duprRating(player: Player): number {
    return player.dupr.duprDoublesRating ?? 0;
  }

  skillLevel(player: Player) {
    return getSkillLevelFromDupr(player.dupr.duprDoublesRating);
  }
}

export const playerService = new PlayerService();
