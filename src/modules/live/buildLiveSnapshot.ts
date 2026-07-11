import { queueEntryLabel, splitTeams } from '@/lib/format-utils';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import {
  buildAutoPreviewLineups,
  buildNextStackLineupPlayerIds,
  computeStackLineupCount,
  getAllWaitingStackIds,
  WIN_LOSE_STACK_PLAYERS,
} from '@/modules/game-mode/winLoseStackMode';
import { isRotationPaused } from '@/types/queue';
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

function getCompleteLineups(lineups: string[][]): string[][] {
  return lineups.filter(
    (lineup) =>
      lineup.length === WIN_LOSE_STACK_PLAYERS && new Set(lineup).size === WIN_LOSE_STACK_PLAYERS
  );
}

function toPublicPlayer(player: Player): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    gender: player.gender,
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
  const withGames = players.filter((player) => player.gamesPlayed > 0);
  const sorted = [...withGames].sort((a, b) => comparePlayersForRanking(a, b, 'session'));
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
  gameMode: GameMode,
  options: {
    stackStagedLineups?: string[][];
    openCourtCount?: number;
  } = {}
): PublicQueueEntry[] {
  if (gameMode === 'win_lose_stack' && queueState.winLoseStack) {
    const stack = queueState.winLoseStack;
    const crossStack = isRotationPaused(queueState);
    const waitingCount = getAllWaitingStackIds(stack).length;
    const lineupCount = computeStackLineupCount(options.openCourtCount ?? 1, waitingCount);

    let lineups: string[][] = [];
    if (crossStack) {
      lineups = getCompleteLineups(options.stackStagedLineups ?? []).slice(0, lineupCount);
    } else {
      lineups = buildAutoPreviewLineups(stack, lineupCount);
    }

    // Fallback: single legacy selection path if nothing staged yet.
    if (lineups.length === 0 && crossStack) {
      const flat = (options.stackStagedLineups ?? []).flat().slice(0, WIN_LOSE_STACK_PLAYERS);
      const playerIds = buildNextStackLineupPlayerIds(stack, flat, { crossStack: true });
      if (playerIds) lineups = [playerIds];
    }

    return lineups.map((playerIds, index) => {
      const stackLabel = crossStack
        ? lineups.length > 1
          ? `Lineup ${index + 1}`
          : 'Next game'
        : stack.nextUp === 'winners'
          ? 'Winners stack'
          : 'Losers stack';
      const { teamA, teamB } = splitTeams(playerIds);
      const namesA = teamA
        .map((id) => players.find((p) => p.id === id)?.name ?? '?')
        .join(' & ');
      const namesB = teamB
        .map((id) => players.find((p) => p.id === id)?.name ?? '?')
        .join(' & ');

      return {
        position: index + 1,
        playerIds,
        label: `${stackLabel}: ${namesA} vs ${namesB}`,
        format: 'doubles' as const,
      };
    });
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
  /** Manual win/lose stack staged lineups when auto-rotation is paused. */
  stackStagedLineups?: string[][];
  /** @deprecated Prefer stackStagedLineups. */
  stackSelectedPlayerIds?: string[];
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
    queueNext: buildQueueNext(input.queueState, input.players, gameMode, {
      stackStagedLineups:
        input.stackStagedLineups ??
        (input.stackSelectedPlayerIds ? [input.stackSelectedPlayerIds] : undefined),
      openCourtCount: input.courts.filter((court) => !court.activeMatchId).length,
    }),
    completedMatches: input.queueState.completedMatches.map((m) =>
      toPublicMatch(m, input.courts, 'completed')
    ),
    rankings: rankingsWithDeltas,
    rankingDeltas,
    players: input.players.filter((p) => !p.excluded).map(toPublicPlayer),
    viewerStats: input.viewerStats,
  };
}
