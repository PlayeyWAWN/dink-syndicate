import { PublicRankingRow } from '@/types/live';

const RANK_ALERT_TTL_MS = 45_000;

export interface WallboardRankAlert {
  playerId: string;
  message: string;
  expiresAt: number;
}

let activeAlerts: WallboardRankAlert[] = [];
let previousRankings: PublicRankingRow[] = [];

function stripDeltas(rows: PublicRankingRow[]): PublicRankingRow[] {
  return rows.map((row) => {
    const { delta: _delta, ...rest } = row;
    return rest as PublicRankingRow;
  });
}

function pickTemplate(templates: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i)) | 0;
  }
  return templates[Math.abs(hash) % templates.length];
}

function formatRank(rank: number): string {
  return `#${rank}`;
}

function buildNewEntrantMessage(row: PublicRankingRow, previous: PublicRankingRow[]): string {
  const fallen =
    row.rank === 10
      ? previous.find((entry) => entry.rank === 10 && entry.playerId !== row.playerId)
      : undefined;

  if (fallen) {
    return pickTemplate(
      [
        `${row.name} takes ${formatRank(row.rank)} — ${fallen.name} drops out of the Top 10!`,
        `${row.name} sneaks into ${formatRank(row.rank)} and bumps ${fallen.name} off the board!`,
        `${row.name} grabs the last Top 10 spot at ${formatRank(row.rank)}, sending ${fallen.name} packing!`,
      ],
      `${row.playerId}-new-${row.rank}`
    );
  }

  return pickTemplate(
    [
      `${row.name} enters the Top 10 at ${formatRank(row.rank)}!`,
      `${row.name} crashes into the Top 10 at ${formatRank(row.rank)}!`,
      `${row.name} lands on the Top 10 board at ${formatRank(row.rank)}!`,
      `${row.name} breaks into the Top 10 at ${formatRank(row.rank)}!`,
    ],
    `${row.playerId}-new-${row.rank}`
  );
}

function buildClimbMessage(
  row: PublicRankingRow,
  previous: PublicRankingRow[]
): string {
  const prevRow = previous.find((entry) => entry.playerId === row.playerId);
  if (!prevRow || row.rank >= prevRow.rank) return '';

  const displaced = previous.find(
    (entry) => entry.rank === row.rank && entry.playerId !== row.playerId
  );

  if (displaced) {
    return pickTemplate(
      [
        `${row.name} knocks ${displaced.name} from the ${formatRank(row.rank)} spot!`,
        `${row.name} snatches ${formatRank(row.rank)} from ${displaced.name}!`,
        `${row.name} stomps ${displaced.name} down — now sitting at ${formatRank(row.rank)}!`,
        `${row.name} climbs to ${formatRank(row.rank)}, bumping ${displaced.name}!`,
        `${row.name} shoves ${displaced.name} out of ${formatRank(row.rank)}!`,
      ],
      `${row.playerId}-up-${row.rank}-${displaced.playerId}`
    );
  }

  return pickTemplate(
    [
      `${row.name} climbs to ${formatRank(row.rank)}!`,
      `${row.name} rockets up to ${formatRank(row.rank)}!`,
      `${row.name} surges to ${formatRank(row.rank)} on the board!`,
    ],
    `${row.playerId}-up-${row.rank}`
  );
}

function buildRankCommentary(
  row: PublicRankingRow,
  previous: PublicRankingRow[]
): string | null {
  if (!row.delta || row.delta === 'same') return null;

  if (row.delta === 'new') {
    return buildNewEntrantMessage(row, previous) || null;
  }

  if (row.delta === 'up') {
    return buildClimbMessage(row, previous) || null;
  }

  if (row.delta === 'down') {
    const prevRow = previous.find((entry) => entry.playerId === row.playerId);
    if (!prevRow || row.rank <= prevRow.rank) return null;
    return pickTemplate(
      [
        `${row.name} slides down to ${formatRank(row.rank)}.`,
        `${row.name} drops to ${formatRank(row.rank)} on the board.`,
      ],
      `${row.playerId}-down-${row.rank}`
    );
  }

  return null;
}

/** Track ranking moves and keep commentary alerts visible for several seconds. */
export function processWallboardRankAlerts(rankings: PublicRankingRow[]): WallboardRankAlert[] {
  const now = Date.now();
  const previous = previousRankings;

  const hasPlayed = rankings.some((row) => row.gamesPlayed > 0);
  const hasPrevious = previous.some((row) => row.gamesPlayed > 0);

  if (hasPlayed && hasPrevious) {
    for (const row of rankings) {
      const message = buildRankCommentary(row, previous);
      if (!message) continue;

      const alertId = `${row.playerId}-${row.rank}-${row.delta ?? 'move'}`;
      const alreadyActive = activeAlerts.some(
        (alert) => alert.playerId === alertId && alert.expiresAt > now
      );
      if (alreadyActive) continue;

      activeAlerts.push({
        playerId: alertId,
        message,
        expiresAt: now + RANK_ALERT_TTL_MS,
      });
    }
  }

  previousRankings = stripDeltas(rankings);
  activeAlerts = activeAlerts.filter((alert) => alert.expiresAt > now);
  return activeAlerts;
}

export function hasActiveWallboardRankAlerts(): boolean {
  return activeAlerts.some((alert) => alert.expiresAt > Date.now());
}

/** Clears in-memory alerts (used by tests). */
export function resetWallboardRankAlerts(): void {
  activeAlerts = [];
  previousRankings = [];
}
