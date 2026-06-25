import { sanitizeExportSegment } from '@/lib/export-image';
import {
  MatchHistoryData,
  MatchHistoryRow,
} from '@/modules/stats/MatchHistoryService';
import {
  formatAnalyticsDuration,
  formatAnalyticsMatchDuration,
  formatUtilizationPercent,
} from '@/modules/stats/QueueAnalyticsService';

export function buildMatchHistoryExportFilename(
  sessionName: string,
  extension: 'txt' | 'csv' | 'png',
  date = new Date()
): string {
  const label = sanitizeExportSegment(sessionName) || 'session';
  const day = date.toISOString().slice(0, 10);
  return `dink-${label}-queue-${day}.${extension}`;
}

function formatCompletedAt(completedAt: number | null): string {
  if (completedAt == null) return '—';
  return new Date(completedAt).toLocaleString();
}

function analyticsHeader(data: MatchHistoryData): string[] {
  const { analytics } = data;
  return [
    'Queue Analytics',
    `Total matches: ${analytics.matchesCompletedThisSession}`,
    `Avg queue wait: ${formatAnalyticsDuration(analytics.avgQueueWaitMs)}`,
    `Avg match length: ${formatAnalyticsMatchDuration(analytics.avgMatchDurationMs)}`,
    `Longest player wait: ${formatAnalyticsDuration(analytics.longestAvailableWaitMs)}`,
    `Court utilization: ${formatUtilizationPercent(analytics.courtUtilizationPercent)}`,
    `Matches this hour: ${analytics.matchesCompletedLastHour}`,
    `Waiting in queue: ${analytics.currentQueueDepth}`,
    '',
  ];
}

function matchLines(rows: MatchHistoryRow[]): string[] {
  if (rows.length === 0) return ['No completed matches yet.'];
  return rows.map((row) => {
    const base =
      `#${row.matchNumber} | ${row.label} | Winner: ${row.winnerLabel} | Wait: ${row.waitLabel} | Duration: ${row.durationLabel} | Completed: ${formatCompletedAt(row.completedAt)}`;
    return row.note ? `${base} | Note: ${row.note}` : base;
  });
}

export function buildMatchHistoryTxt(data: MatchHistoryData, sessionName: string): string {
  const lines = [
    `Dink Syndicate — Queue Analytics`,
    `Session: ${sessionName}`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    ...analyticsHeader(data),
    `All Matches (${data.matches.length})`,
    ...matchLines(data.matches),
  ];

  if (data.waitingPlayers.length > 0) {
    lines.push('', 'Longest waiting players (ready to be queued)');
    for (const [index, player] of data.waitingPlayers.entries()) {
      lines.push(
        `#${index + 1} ${player.name} | ${player.gamesPlayed} games played | Wait: ${player.waitLabel}`
      );
    }
  }

  return lines.join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildMatchHistoryCsv(data: MatchHistoryData): string {
  const header = [
    'Match #',
    'Teams',
    'Winner',
    'Wait',
    'Duration',
    'Format',
    'Completed At',
    'Note',
  ];
  const rows = data.matches.map((row) => [
    String(row.matchNumber),
    row.label,
    row.winnerLabel,
    row.waitLabel,
    row.durationLabel,
    row.format,
    formatCompletedAt(row.completedAt),
    row.note ?? '',
  ]);

  return [header, ...rows].map((line) => line.map(csvEscape).join(',')).join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
