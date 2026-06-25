import { Match, QueueEntry, QueueState } from '@/types/queue';
import { isPlayerMatchable, isPlayerPaused, Player } from '@/types/player';
import { createId } from '@/modules/matchmaking/create-id';


/** Queue state operations — match creation lives in MatchmakingService. */

export class QueueService {

  /** Player IDs already assigned to the waiting queue. */

  getQueuedPlayerIds(state: QueueState): Set<string> {

    const ids = new Set<string>();

    for (const entry of state.queue) {

      for (const id of entry.playerIds) ids.add(id);

    }

    return ids;

  }



  /** Player IDs currently on court. */

  getActivePlayerIds(state: QueueState): Set<string> {

    const ids = new Set<string>();

    for (const match of state.activeMatches) {

      for (const id of match.playerIds) ids.add(id);

    }

    return ids;

  }



  /** Checked-in players not waiting in queue or playing on a court. */

  getAvailablePlayers(players: Player[], state: QueueState): Player[] {

    const busy = new Set([...this.getQueuedPlayerIds(state), ...this.getActivePlayerIds(state)]);

    return players.filter((p) => isPlayerMatchable(p) && !busy.has(p.id));

  }



  /** Checked-out, paused, or session-excluded — not queued or on court. */

  getStandbyExcludedPlayers(players: Player[], state: QueueState, now = Date.now()): Player[] {

    const busy = new Set([...this.getQueuedPlayerIds(state), ...this.getActivePlayerIds(state)]);

    return players.filter(
      (p) =>
        !busy.has(p.id) &&
        (!p.checkedIn || p.excluded || isPlayerPaused(p, now))
    );

  }



  sortStandbyExcludedPlayers(players: Player[], now = Date.now()): Player[] {

    const paused = players
      .filter((p) => isPlayerPaused(p, now))
      .sort((a, b) => (a.pausedUntil ?? 0) - (b.pausedUntil ?? 0));

    const excluded = players
      .filter((p) => p.excluded && !isPlayerPaused(p, now))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const notCheckedIn = players
      .filter((p) => !p.checkedIn && !p.excluded && !isPlayerPaused(p, now))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return [...paused, ...excluded, ...notCheckedIn];

  }



  enqueue(state: QueueState, entry: QueueEntry): QueueState {

    return { ...state, queue: [...state.queue, entry] };

  }



  dequeue(state: QueueState, entryId: string): QueueState {

    return { ...state, queue: state.queue.filter((e) => e.id !== entryId) };

  }



  startMatch(state: QueueState, entry: QueueEntry, courtId: string): QueueState {

    const match: Match = {

      id: createId('match'),

      courtId,

      playerIds: entry.playerIds,

      format: entry.format,

      status: 'active',

      winnerPlayerIds: [],

      queuedAt: entry.createdAt,

      availableSinceByPlayer: entry.availableSinceByPlayer,

      source: entry.source,

      startedAt: Date.now(),

    };

    return {

      ...state,

      queue: state.queue.filter((e) => e.id !== entry.id),

      activeMatches: [...state.activeMatches, match],

    };

  }

  /** Return an active match to the front of the queue without changing player stats. */
  returnActiveMatchToQueue(state: QueueState, matchId: string): QueueState | null {
    const match = state.activeMatches.find((item) => item.id === matchId);
    if (!match) return null;

    const entry: QueueEntry = {
      id: createId('queue'),
      playerIds: match.playerIds,
      format: match.format,
      createdAt: match.queuedAt ?? Date.now(),
      availableSinceByPlayer: match.availableSinceByPlayer,
      source: match.source,
    };

    return {
      ...state,
      activeMatches: state.activeMatches.filter((item) => item.id !== matchId),
      queue: [entry, ...state.queue],
    };
  }

}



export const queueService = new QueueService();

