import { PublicRankingRow } from '@/types/live';

const HIGHLIGHT_TTL_MS = 20_000;

export interface WallboardRankHighlight {
  message: string;
  expiresAt: number;
}

let currentHighlight: WallboardRankHighlight | null = null;
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

interface RankHighlightCandidate {
  priority: number;
  message: string;
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

function buildClimbMessage(row: PublicRankingRow, previous: PublicRankingRow[]): string {
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

  const diff = prevRow.rank - row.rank;
  if (diff > 1) {
    return `${row.name} climbed ${diff} spots to ${formatRank(row.rank)}!`;
  }

  return pickTemplate(
    [
      `${row.name} climbs to ${formatRank(row.rank)}!`,
      `${row.name} rockets up to ${formatRank(row.rank)}!`,
      `${row.name} moved up to ${formatRank(row.rank)}!`,
    ],
    `${row.playerId}-up-${row.rank}`
  );
}

function collectRankHighlights(
  rankings: PublicRankingRow[],
  previous: PublicRankingRow[]
): RankHighlightCandidate[] {
  const highlights: RankHighlightCandidate[] = [];
  const prevLeader = previous[0];
  const nextLeader = rankings[0];

  if (
    nextLeader &&
    prevLeader &&
    nextLeader.playerId !== prevLeader.playerId &&
    nextLeader.gamesPlayed > 0
  ) {
    highlights.push({
      priority: 6,
      message: `${nextLeader.name} takes #1!`,
    });
  }

  for (const row of rankings) {
    if (!row.delta || row.delta === 'same') continue;

    if (row.delta === 'new') {
      highlights.push({ priority: 4, message: buildNewEntrantMessage(row, previous) });
      continue;
    }

    if (row.delta === 'up') {
      const message = buildClimbMessage(row, previous);
      if (message) {
        highlights.push({ priority: 5, message });
      }
      continue;
    }

    if (row.delta === 'down') {
      const prevRow = previous.find((entry) => entry.playerId === row.playerId);
      if (!prevRow || row.rank <= prevRow.rank) continue;
      highlights.push({
        priority: 2,
        message: pickTemplate(
          [
            `${row.name} slides down to ${formatRank(row.rank)}.`,
            `${row.name} drops to ${formatRank(row.rank)} on the board.`,
          ],
          `${row.playerId}-down-${row.rank}`
        ),
      });
    }
  }

  const currentIds = new Set(rankings.map((row) => row.playerId));
  for (const prev of previous) {
    if (prev.rank <= 10 && !currentIds.has(prev.playerId)) {
      highlights.push({
        priority: 3,
        message: `${prev.name} dropped out of the Top 10`,
      });
    }
  }

  return highlights;
}

function pickBestHighlight(candidates: RankHighlightCandidate[]): string | null {
  if (candidates.length === 0) return null;
  const best = candidates.reduce((acc, candidate) =>
    candidate.priority > acc.priority ? candidate : acc
  );
  return best.message;
}

function pruneExpiredHighlight(now: number): void {
  if (currentHighlight && currentHighlight.expiresAt <= now) {
    currentHighlight = null;
  }
}

function rankingsSnapshotKey(rows: PublicRankingRow[]): string {
  return rows
    .map(
      (row) =>
        `${row.playerId}:${row.rank}:${row.wins}:${row.losses}:${row.gamesPlayed}:${row.points}`
    )
    .join('|');
}

/**
 * Track the latest ranking move and show one highlight banner (Smash Syndicate style).
 * New events replace the previous message instead of stacking.
 */
export function processWallboardRankAlerts(rankings: PublicRankingRow[]): WallboardRankHighlight | null {
  const now = Date.now();
  pruneExpiredHighlight(now);

  const previous = previousRankings;
  const hasPlayed = rankings.some((row) => row.gamesPlayed > 0);
  const hasPrevious = previous.some((row) => row.gamesPlayed > 0);
  const rankingsChanged = rankingsSnapshotKey(previous) !== rankingsSnapshotKey(rankings);

  if (hasPlayed && hasPrevious && rankingsChanged) {
    const message = pickBestHighlight(collectRankHighlights(rankings, previous));
    if (message) {
      currentHighlight = { message, expiresAt: now + HIGHLIGHT_TTL_MS };
    }
  }

  previousRankings = stripDeltas(rankings);
  pruneExpiredHighlight(now);
  return currentHighlight;
}

export function hasActiveWallboardRankAlerts(): boolean {
  const now = Date.now();
  pruneExpiredHighlight(now);
  return currentHighlight !== null;
}

/** When the current highlight expires (ms since epoch), or null if none. */
export function getWallboardRankHighlightExpiry(): number | null {
  const now = Date.now();
  pruneExpiredHighlight(now);
  return currentHighlight?.expiresAt ?? null;
}

/** Update the highlight banner in place without re-rendering the wallboard. */
export function syncWallboardRankHighlightDom(root: HTMLElement): void {
  const now = Date.now();
  pruneExpiredHighlight(now);
  const banner = root.querySelector('.live-wallboard__rank-highlight');
  if (!banner) return;

  const message = currentHighlight?.message;
  if (message) {
    banner.textContent = message;
    banner.classList.remove('is-empty');
    banner.removeAttribute('aria-hidden');
  } else {
    banner.textContent = '';
    banner.classList.add('is-empty');
    banner.setAttribute('aria-hidden', 'true');
  }
}

/** Clears in-memory highlight (used by tests). */
export function resetWallboardRankAlerts(): void {
  currentHighlight = null;
  previousRankings = [];
}
