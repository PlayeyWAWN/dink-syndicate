import { el } from '@/lib/dom-utils';
import { clearLiveTimers, mountLiveTimers } from '@/lib/match-timer';
import { getAvailableWaitThresholds } from '@/lib/session-settings-utils';
import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { appRouter } from '@/app/router';
import { renderActiveMatchesPanel } from '@/ui/components/ActiveMatchesPanel';
import { renderAvailablePlayersPanel } from '@/ui/components/AvailablePlayersPanel';
import { renderExcludedPlayersPanel } from '@/ui/components/ExcludedPlayersPanel';
import { renderRecentCompletedMatchesPanel } from '@/ui/components/RecentCompletedMatchesPanel';
import { renderMatchQueueSection } from '@/ui/components/MatchQueueSection';
import { renderWinLoseStackPanel } from '@/ui/components/WinLoseStackPanel';
import { renderLadderWaterfallPanel } from '@/ui/components/LadderWaterfallPanel';
import { openBalanceNoticeDialog } from '@/ui/components/BalanceNoticeDialog';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import { isLadderWaterfallMode, isWinLoseStackMode } from '@/types/game-mode';
import { openPlayerPauseDialog } from '@/ui/components/PlayerPauseDialog';
import {
  assessMatchBalance,
  buildManualMatch,
} from '@/modules/queue/ManualMatchService';
import { renderLivePublishPanel } from '@/ui/components/LivePublishPanel';
import { livePublishService } from '@/modules/live/LivePublishService';
export function renderQueueScreen(container: HTMLElement): void {
  clearLiveTimers(container);

  if (livePublishService.isPublishEnabled()) {
    void livePublishService.syncSnapshot();
  }

  container.append(
    renderLivePublishPanel({
      onChange: () => appRouter.navigate('queue'),
    })
  );

  const {
    queueState,
    getAvailablePlayers,
    getStandbyExcludedPlayers,
    completeMatch,
    cancelActiveMatch,
    swapActiveMatchPlayers,
    replaceActiveMatchPlayer,
    updateCompletedMatch,
  } = useQueueStore.getState();
  const courtFormat = useQueueUiStore.getState().courtFormat;
  const matchMode = useQueueUiStore.getState().matchMode;
  const selectedPlayerIds = useQueueUiStore.getState().selectedPlayerIds;
  const requiredCount = courtFormat === 'singles' ? 2 : 4;
  const players = usePlayerStore.getState().players;
  const courts = useCourtStore.getState().courts;
  const available = getAvailablePlayers();
  const standbyExcluded = getStandbyExcludedPlayers();
  const openCourts = courts.filter((c) => !c.activeMatchId);
  const appSettings = useSessionStore.getState().loadSnapshot()?.settings;
  const gameMode = getGameMode(appSettings);
  const stackMode = isWinLoseStackMode(gameMode);
  const ladderMode = isLadderWaterfallMode(gameMode);
  const waitThresholds = getAvailableWaitThresholds(appSettings);
  const synergyPairs = appSettings?.synergyPairs ?? [];
  const synergyDisplay = {
    synergyTeamsEnabled: appSettings?.synergyTeamsEnabled === true,
    synergyPairs,
    rosterPlayers: players,
  };

  if (!ladderMode) {
    container.append(
      renderActiveMatchesPanel({
        matches: queueState.activeMatches,
        courts,
        players,
        available,
        synergy: synergyDisplay,
        onComplete: (matchId, team) => {
          completeMatch(matchId, team);
          appRouter.navigate('queue');
        },
        onCancel: (matchId) => {
          cancelActiveMatch(matchId);
          appRouter.navigate('queue');
        },
        onSwapPlayer: (matchId, playerIdA, playerIdB) => {
          const ok = swapActiveMatchPlayers(matchId, playerIdA, playerIdB);
          if (ok) appRouter.navigate('queue');
          return ok;
        },
        onReplacePlayer: (matchId, oldPlayerId, newPlayerId) => {
          const ok = replaceActiveMatchPlayer(matchId, oldPlayerId, newPlayerId);
          if (ok) appRouter.navigate('queue');
          return ok;
        },
      })
    );
  }

  if (stackMode) {
    useQueueStore.getState().reconcileWinLoseStackState();
    const liveQueueState = useQueueStore.getState().queueState;
    container.append(
      renderWinLoseStackPanel({
        queueState: liveQueueState,
        players,
        openCourtCount: openCourts.length,
        activeMatchCount: liveQueueState.activeMatches.length,
        onNavigate: () => appRouter.navigate('queue'),
      })
    );
  } else if (ladderMode) {
    useQueueStore.getState().reconcileLadderState();
    const liveQueueState = useQueueStore.getState().queueState;
    container.append(
      renderLadderWaterfallPanel({
        queueState: liveQueueState,
        courts,
        players,
        available,
        activeMatchCount: liveQueueState.activeMatches.length,
        onNavigate: () => appRouter.navigate('queue'),
        onComplete: (matchId, team) => {
          completeMatch(matchId, team);
          appRouter.navigate('queue');
        },
        onCancel: (matchId) => {
          cancelActiveMatch(matchId);
          appRouter.navigate('queue');
        },
        onSwapPlayer: (matchId, playerIdA, playerIdB) => {
          const ok = swapActiveMatchPlayers(matchId, playerIdA, playerIdB);
          if (ok) appRouter.navigate('queue');
          return ok;
        },
        onReplacePlayer: (matchId, oldPlayerId, newPlayerId) => {
          const ok = replaceActiveMatchPlayer(matchId, oldPlayerId, newPlayerId);
          if (ok) appRouter.navigate('queue');
          return ok;
        },
      })
    );
  } else {
    const { section: matchQueueSection, createMatchBtn } = renderMatchQueueSection({
      courtFormat,
      matchMode,
      openCourtCount: openCourts.length,
      players,
      synergy: synergyDisplay,
    });
    container.append(matchQueueSection);

    container.append(
      renderAvailablePlayersPanel(available, createMatchBtn, {
        waitThresholds: {
          warnMinutes: Math.round(waitThresholds.warnMs / 60_000),
          criticalMinutes: Math.round(waitThresholds.criticalMs / 60_000),
        },
        selectedPlayerIds,
        requiredCount,
        synergyPairs,
        synergyTeamsEnabled: synergyDisplay.synergyTeamsEnabled,
        rosterPlayers: players,
        onPlayerTap: (playerId) => {
          const ui = useQueueUiStore.getState();
          if (
            !ui.selectedPlayerIds.includes(playerId) &&
            ui.selectedPlayerIds.length >= requiredCount
          ) {
            return;
          }
          ui.toggleSelectedPlayer(playerId);
          appRouter.navigate('queue');
        },
        onClearSelection: () => {
          useQueueUiStore.getState().clearSelection();
          appRouter.navigate('queue');
        },
        onBuildManualMatch: () => {
          const ui = useQueueUiStore.getState();
          if (ui.selectedPlayerIds.length !== requiredCount) {
            alert(`Select ${requiredCount} players to build a manual match.`);
            return;
          }

          const selected = ui.selectedPlayerIds
            .map((id) => players.find((player) => player.id === id))
            .filter(Boolean) as typeof players;
          const built = buildManualMatch(
            ui.courtFormat,
            ui.matchMode,
            selected,
            appSettings
          );
          if (!built.ok) {
            alert(built.message);
            return;
          }

          const assessment = assessMatchBalance(built.format, built.playerIds, players);
          openBalanceNoticeDialog({
            assessment,
            onConfirm: () => {
              const result = useQueueStore
                .getState()
                .createManualMatch(ui.courtFormat, ui.matchMode, ui.selectedPlayerIds);
              if (!result.ok) {
                alert(result.message);
                return;
              }
              useQueueUiStore.getState().clearSelection();
              appRouter.navigate('queue');
            },
          });
        },
        onPausePlayer: (playerId) => {
          const player = players.find((item) => item.id === playerId);
          if (!player) return;
          openPlayerPauseDialog({
            playerName: player.name,
            onSelectDuration: (durationMs) => {
              usePlayerStore.getState().pausePlayer(playerId, durationMs);
              const ui = useQueueUiStore.getState();
              if (ui.selectedPlayerIds.includes(playerId)) {
                ui.toggleSelectedPlayer(playerId);
              }
              appRouter.navigate('queue');
            },
          });
        },
      })
    );
  }

  container.append(
    renderExcludedPlayersPanel(standbyExcluded, {
      onCheckIn: (playerId) => {
        usePlayerStore.getState().toggleCheckIn(playerId);
        appRouter.navigate('queue');
      },
      onReturnFromBreak: (playerId) => {
        usePlayerStore.getState().returnFromBreak(playerId);
        appRouter.navigate('queue');
      },
      onInclude: (playerId) => {
        usePlayerStore.getState().setExcluded(playerId, false);
        appRouter.navigate('queue');
      },
    })
  );

  container.append(
    renderRecentCompletedMatchesPanel({
      completedMatches: queueState.completedMatches,
      players,
      onUpdateMatch: (matchId, update) => {
        const result = updateCompletedMatch(matchId, update);
        if (result.ok) appRouter.navigate('queue');
        return result;
      },
    })
  );

  mountLiveTimers(container, {
    availableWaitWarnMs: waitThresholds.warnMs,
    availableWaitCriticalMs: waitThresholds.criticalMs,
    onPauseExpired: () => {
      appRouter.navigate('queue');
    },
  });
}