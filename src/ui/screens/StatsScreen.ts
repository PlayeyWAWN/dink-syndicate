import { el } from '@/lib/dom-utils';
import { buildStatsExportFilename, exportReportAsPng } from '@/lib/export-image';
import { computeQueueAnalytics } from '@/modules/stats/QueueAnalyticsService';
import { buildStatsReportData } from '@/modules/stats/StatsReportService';
import { computeArrivalAnalytics } from '@/modules/stats/ArrivalAnalyticsService';
import {
  renderSummaryExportReport,
} from '@/ui/components/StatsExportReport';
import { renderArrivalAnalyticsPanel } from '@/ui/components/ArrivalAnalyticsPanel';
import { renderQueueAnalyticsPanel } from '@/ui/components/QueueAnalyticsPanel';
import { renderRankingsTablePanel } from '@/ui/components/RankingsTablePanel';
import { renderSessionSummaryHighlights } from '@/ui/components/SessionSummaryHighlights';
import { renderStatsViewToggle } from '@/ui/components/StatsViewToggle';
import { createStatsScopeBadge } from '@/ui/components/RankingDisplay';
import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useStatsUiStore } from '@/stores/statsUiStore';
import { getPlayerStatsForView, StatsView } from '@/types/player';
import { appRouter } from '@/app/router';

function statCard(label: string, value: string): HTMLElement {
  return el('div', { className: 'stat-card' }, [el('strong', {}, [value]), el('span', {}, [label])]);
}

function attachReportExportButton(
  label: string,
  suffix: 'summary' | 'rankings',
  sessionName: string,
  statsView: StatsView,
  buildReport: () => HTMLElement
): HTMLElement {
  const button = el('button', { type: 'button', className: 'btn btn-secondary stats-export-btn' }, [
    label,
  ]);

  button.addEventListener('click', async () => {
    button.setAttribute('disabled', 'true');
    const originalLabel = button.textContent;
    button.textContent = 'Exporting…';

    try {
      await exportReportAsPng(
        buildReport(),
        buildStatsExportFilename(sessionName, suffix, statsView)
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      button.removeAttribute('disabled');
      button.textContent = originalLabel ?? label;
    }
  });

  return button;
}

export function renderStatsScreen(container: HTMLElement): void {
  const statsView = useStatsUiStore.getState().statsView;
  const players = usePlayerStore.getState().players;
  const courts = useCourtStore.getState().courts;
  const queueState = useQueueStore.getState().queueState;
  const { completedMatches, activeMatches } = queueState;
  const snapshot = useSessionStore.getState().loadSnapshot();
  const archiveCount = snapshot?.sessionArchives?.length ?? 0;
  const sessionName = snapshot?.settings?.organizerName ?? 'session';

  const totalGames = players.reduce(
    (sum, player) => sum + getPlayerStatsForView(player, statsView).gamesPlayed,
    0
  );

  const analytics = computeQueueAnalytics({
    queueState,
    courts,
    players,
    sessionStartTime: snapshot?.settings?.sessionStartTime,
  });

  const arrivalAnalytics = computeArrivalAnalytics(players, snapshot?.settings);

  const reportData = buildStatsReportData({
    statsView,
    sessionName,
    players,
    completedMatches,
    activeMatchCount: activeMatches.length,
    analytics,
  });

  const buildReportData = () => reportData;

  const header = el('div', { className: 'section-header' });
  header.append(el('div', { className: 'section-title' }, ['Stats']));
  container.append(header);

  const toolbar = el('div', { className: 'stats-toolbar' });
  toolbar.append(
    renderStatsViewToggle(statsView, (view) => {
      useStatsUiStore.getState().setStatsView(view);
      appRouter.navigate('stats');
    })
  );
  container.append(toolbar);

  container.append(
    el('p', { className: 'screen-lead' }, [
      statsView === 'session'
        ? 'Session stats reset when you start a new session. End session to archive results.'
        : `Lifetime totals across all sessions${archiveCount > 0 ? ` (${archiveCount} archived)` : ''}.`,
    ])
  );

  container.append(
    renderRankingsTablePanel({
      players,
      statsView,
      sessionName,
      buildReportData,
    })
  );

  const summarySection = el('section', { className: 'card stats-section' });
  summarySection.append(
    el('div', { className: 'stats-section__title-row' }, [
      el('h3', { className: 'stats-section__title' }, ['Session summary']),
      createStatsScopeBadge(statsView, 'app'),
    ]),
    el('p', { className: 'stats-section__lead' }, [
      statsView === 'session' ? 'Current session totals.' : 'Career totals for checked-in roster.',
    ])
  );

  const summaryGrid = el('div', { className: 'stat-grid stats-section__grid' });
  summaryGrid.append(
    statCard('Games played', String(totalGames)),
    statCard('Matches completed', String(completedMatches.length)),
    statCard('Active now', String(activeMatches.length)),
    statCard('Players', String(players.length))
  );
  summarySection.append(summaryGrid);
  summarySection.append(
    renderSessionSummaryHighlights({
      starPlayers: reportData.starPlayers,
      pairStatistics: reportData.pairStatistics,
      playersNeedingEncouragement: reportData.playersNeedingEncouragement,
    })
  );
  summarySection.append(
    attachReportExportButton('Export session summary PNG', 'summary', sessionName, statsView, () =>
      renderSummaryExportReport(buildReportData())
    )
  );
  container.append(summarySection);

  container.append(renderArrivalAnalyticsPanel(arrivalAnalytics));

  container.append(
    renderQueueAnalyticsPanel({
      completedMatches,
      players,
      analytics,
      sessionName,
    })
  );
}
