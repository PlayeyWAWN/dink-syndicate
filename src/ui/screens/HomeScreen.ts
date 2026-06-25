import { APP_NAME, LOGO_URL } from '@/config/constants';
import { el } from '@/lib/dom-utils';
import { winRate } from '@/lib/format-utils';
import { comparePlayersForRanking, computeRankingPoints } from '@/modules/stats/ranking-utils';
import { isOnline } from '@/lib/offline-utils';
import { useCourtStore } from '@/stores/courtStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useStatsUiStore } from '@/stores/statsUiStore';
import { getPlayerStatsForView } from '@/types/player';
import { renderStatsViewToggle } from '@/ui/components/StatsViewToggle';
import { renderInstallAppBanner } from '@/ui/components/InstallAppBanner';
import { mountAppIcon } from '@/ui/icons/app-icons';
import { appRouter } from '@/app/router';

export function renderHomeScreen(container: HTMLElement): void {
  const session = useSessionStore.getState().session;
  const statsView = useStatsUiStore.getState().statsView;
  const players = usePlayerStore.getState().players;
  const courts = useCourtStore.getState().courts;
  const { queueState } = useQueueStore.getState();
  const openCourts = courts.filter((c) => !c.activeMatchId).length;

  const wrap = el('div', { style: 'text-align: center; padding: 8px 0 20px;' });

  const logo = el('div', { className: 'home-logo home-logo--brand' });
  const logoImg = el('img', {
    src: LOGO_URL,
    alt: 'Dink Syndicate logo',
  }) as HTMLImageElement;
  logo.append(logoImg);

  wrap.append(
    logo,
    el('h1', { className: 'home-title' }, [APP_NAME]),
    el('p', { className: 'home-subtitle' }, [
      'Pickleball queue manager — players, courts, matches, stats',
    ]),
    el('p', { style: 'font-size: 14px; margin-bottom: 12px; opacity: 0.85;' }, [
      `Organizer: ${session?.organizerName ?? 'Queue Master'}`,
    ]),
    el('span', {
      className: 'offline-badge',
      'data-online': String(isOnline()),
      id: 'connectivity-badge',
    }, [isOnline() ? 'Online' : 'Offline'])
  );

  const offlineBanner = el('div', { className: 'notice-banner notice-banner--offline' });
  offlineBanner.append(
    el('div', { className: 'notice-banner__title' }, ['Works fully offline']),
    el('div', { className: 'notice-banner__body' }, [
      'Local first: run a full club session with no internet after the first load. Export roster JSON in Settings to move data between devices.',
    ])
  );
  wrap.append(offlineBanner);

  const installBanner = renderInstallAppBanner();
  if (installBanner) {
    wrap.append(installBanner);
  }

  const modeCard = el('div', { className: 'mode-card', id: 'queue-mode-btn' });
  const modeIcon = el('div', { className: 'mode-icon' });
  mountAppIcon(modeIcon, 'pickleball');
  modeCard.append(
    modeIcon,
    el('h3', { style: 'color: var(--accent); margin: 0 0 4px;' }, ['Queue Manager']),
    el('p', { style: 'font-size: 14px; margin: 0; color: var(--text-muted);' }, [
      'Manage players, queue, courts, and stats',
    ])
  );
  modeCard.addEventListener('click', () => appRouter.navigate('players'));
  wrap.append(modeCard);

  const statsRow = el('div', { className: 'stat-grid', style: 'max-width: 420px; margin: 16px auto;' });
  statsRow.append(
    el('div', { className: 'stat-card' }, [
      el('strong', {}, [String(players.length)]),
      el('span', {}, ['Players']),
    ]),
    el('div', { className: 'stat-card' }, [
      el('strong', {}, [String(queueState.queue.length)]),
      el('span', {}, ['In queue']),
    ]),
    el('div', { className: 'stat-card' }, [
      el('strong', {}, [String(openCourts)]),
      el('span', {}, ['Open courts']),
    ]),
    el('div', { className: 'stat-card' }, [
      el('strong', {}, [String(queueState.completedMatches.length)]),
      el('span', {}, ['Done']),
    ])
  );
  wrap.append(statsRow);

  if (players.length > 0) {
    const leaderboardCard = el('div', {
      className: 'card home-leaderboard-card',
      style: 'max-width: 420px; margin: 0 auto; text-align: left;',
    });
    leaderboardCard.append(el('h3', { style: 'margin: 0 0 0.5rem; font-size: 1rem;' }, ['Top players']));
    leaderboardCard.append(
      renderStatsViewToggle(statsView, (view) => {
        useStatsUiStore.getState().setStatsView(view);
        appRouter.navigate('home');
      })
    );

    const topPlayers = [...players]
      .sort((a, b) => comparePlayersForRanking(a, b, statsView))
      .slice(0, 3);

    const list = el('ul', { className: 'home-leaderboard' });
    for (const player of topPlayers) {
      const stats = getPlayerStatsForView(player, statsView);
      list.append(
        el('li', { className: 'home-leaderboard__item' }, [
          el('span', { className: 'home-leaderboard__name' }, [player.name]),
          el('span', { className: 'home-leaderboard__meta' }, [
            `${computeRankingPoints(stats)} pts · ${stats.wins}-${stats.losses} · ${winRate(stats.wins, stats.gamesPlayed)}`,
          ]),
        ])
      );
    }
    leaderboardCard.append(list);
    wrap.append(leaderboardCard);
  }

  container.append(wrap);
}
