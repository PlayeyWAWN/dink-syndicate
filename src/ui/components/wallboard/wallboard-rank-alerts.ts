import { PublicRankingRow } from '@/types/live';

const RANK_ALERT_TTL_MS = 45_000;

export interface WallboardRankAlert {
  playerId: string;
  message: string;
  expiresAt: number;
}

let activeAlerts: WallboardRankAlert[] = [];

function hasRankingBaseline(rankings: PublicRankingRow[]): boolean {
  return rankings.some((row) => row.delta && row.delta !== 'new');
}

/** Track new Top 10 entrants and keep alerts visible for several seconds. */
export function processWallboardRankAlerts(rankings: PublicRankingRow[]): WallboardRankAlert[] {
  const now = Date.now();

  if (hasRankingBaseline(rankings)) {
    for (const row of rankings) {
      if (row.delta !== 'new') continue;
      const alreadyActive = activeAlerts.some(
        (alert) => alert.playerId === row.playerId && alert.expiresAt > now
      );
      if (alreadyActive) continue;
      activeAlerts.push({
        playerId: row.playerId,
        message: `${row.name} enters the Top 10 at #${row.rank}!`,
        expiresAt: now + RANK_ALERT_TTL_MS,
      });
    }
  }

  activeAlerts = activeAlerts.filter((alert) => alert.expiresAt > now);
  return activeAlerts;
}

export function hasActiveWallboardRankAlerts(): boolean {
  return activeAlerts.some((alert) => alert.expiresAt > Date.now());
}

/** Clears in-memory alerts (used by tests). */
export function resetWallboardRankAlerts(): void {
  activeAlerts = [];
}
