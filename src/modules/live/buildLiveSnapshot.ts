import { queueEntryLabel } from '@/lib/format-utils';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import { getNextUpStackIds } from '@/modules/game-mode/winLoseStackMode';
import { computeRankingDeltas } from '@/modules/live/ranking-deltas';
import { computeRankingPoints, comparePlayersForRanking } from '@/modules/stats/ranking-utils';
import { Court } from '@/types/court';
import { GameMode } from '@/types/game-mode';
import {
  LiveSessionSnapshot,
  PublicMatch,
  PublicPlayer,
  PublicQueueEntry,
  PublicRankingRow,
} from '@/types/live';
import { Player } from '@/types/player';
import { Match, QueueState } from '@/types/queue';
import { AppSettings } from '@/types/app-data';

function toPublicPlayer(player: Player): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    duprDoublesRating: player.dupr?.duprDoublesRating,
    gamesPlayed: player.gamesPlayed,
    wins: player.wins,
    losses: player.losses,
  };
}

function toPublicMatch(match: Match, courts: Court[], status: 'active' | 'completed'): PublicMatch {
  const court = courts.find((c) => c.id === match.courtId);
  const base: PublicMatch = {
    id: match.id,
    courtId: match.courtId ?? '',
    courtLabel: court?.label ?? 'Court',
    playerIds: match.playerIds,
    format: match.format,
    status,
    winnerPlayerIds: match.winnerPlayerIds ?? [],
  };

  if (match.startedAt != null) base.startedAt = match.startedAt;
  if (match.completedAt != null) base.completedAt = match.completedAt;
  if (match.queuedAt != null) base.queuedAt = match.queuedAt;

  return base;
}

function buildRankings(players: Player[]): PublicRankingRow[] {
  const sorted = [...players].sort((a, b) => comparePlayersForRanking(a, b, 'session'));
  return sorted.slice(0, 10).map((player, index) => ({
    rank: index + 1,
    playerId: player.id,
    name: player.name,
    points: computeRankingPoints({
      gamesPlayed: player.gamesPlayed,
      wins: player.wins,
      losses: player.losses,
    }),
    wins: player.wins,
    losses: player.losses,
    gamesPlayed: player.gamesPlayed,
    duprDoublesRating: player.dupr?.duprDoublesRating,
  }));
}

function buildQueueNext(
  queueState: QueueState,
  players: Player[],
  gameMode: GameMode
): PublicQueueEntry[] {
  if (gameMode === 'win_lose_stack' && queueState.winLoseStack) {
    const stackIds = getNextUpStackIds(queueState.winLoseStack);
    if (stackIds.length === 0) return [];
    const label = queueState.winLoseStack.nextUp === 'winners' ? 'Winners stack' : 'Losers stack';
    const names = stackIds
      .map((id) => players.find((p) => p.id === id)?.name ?? '?')
      .join(', ');
    return [
      {
        position: 1,
        playerIds: stackIds,
        label: `${label}: ${names}`,
      },
    ];
  }

  if (gameMode === 'ladder_waterfall' && queueState.ladderWaterfall) {
    const waiting = queueState.ladderWaterfall.waitingPool ?? [];
    return waiting.slice(0, 8).map((playerId, index) => ({
      position: index + 1,
      playerIds: [playerId],
      label: players.find((p) => p.id === playerId)?.name ?? 'Player',
    }));
  }

  return queueState.queue.slice(0, 8).map((entry, index) => ({
    position: index + 1,
    playerIds: entry.playerIds,
    label: queueEntryLabel(entry, players),
    queuedAt: entry.createdAt,
    format: entry.format,
  }));
}

export interface BuildLiveSnapshotInput {
  sessionId: string;
  organizerName: string;
  publishToken: string;
  isActive: boolean;
  settings?: AppSettings;
  courts: Court[];
  queueState: QueueState;
  players: Player[];
  previousRankings?: PublicRankingRow[];
  viewerStats: LiveSessionSnapshot['viewerStats'];
}

/** Build public Firestore payload from local store state. */
export function buildLiveSnapshot(input: BuildLiveSnapshotInput): LiveSessionSnapshot {
  const gameMode = getGameMode(input.settings);
  const rankings = buildRankings(input.players);
  const rankingDeltas = computeRankingDeltas(rankings, input.previousRankings);

  const rankingsWithDeltas = rankings.map((row) => {
    const delta = rankingDeltas[row.playerId];
    return delta ? { ...row, delta } : row;
  });

  return {
    sessionId: input.sessionId,
    organizerName: input.organizerName,
    publishToken: input.publishToken,
    isActive: input.isActive,
    updatedAt: Date.now(),
    gameMode,
    courts: input.courts.map((c) => ({ id: c.id, label: c.label })),
    activeMatches: input.queueState.activeMatches.map((m) =>
      toPublicMatch(m, input.courts, 'active')
    ),
    queueNext: buildQueueNext(input.queueState, input.players, gameMode),
    completedMatches: input.queueState.completedMatches.map((m) =>
      toPublicMatch(m, input.courts, 'completed')
    ),
    rankings: rankingsWithDeltas,
    rankingDeltas,
    viewerStats: input.viewerStats,
  };
}
