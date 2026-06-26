import { el } from '@/lib/dom-utils';
import { APP_VERSION } from '@/config/constants';
import { getFirebaseConfig } from '@/config/firebase';
import { appRouter } from '@/app/router';
import { subscribeAdminDashboard } from '@/modules/analytics/AdminDashboardService';
import { adminRouteLabel, formatDurationMs, formatRelativeTime, gameModeLabel } from '@/modules/analytics/admin-labels';
import { sponsorConfigService } from '@/modules/live/SponsorConfigService';
import { AdminDailyRollup, UserProfile, WallboardDailyRollup } from '@/types/analytics';
import { LiveSessionSnapshot, SponsorConfig } from '@/types/live';

let dashboardUnsub: (() => void) | null = null;

function metricTile(label: string, value: string | number, live = false): HTMLElement {
  const tile = el('div', { className: 'admin-dashboard__tile' });
  if (live) tile.classList.add('admin-dashboard__tile--live');
  tile.append(
    el('div', { className: 'admin-dashboard__tile-value' }, [String(value)]),
    el('div', { className: 'admin-dashboard__tile-label' }, [label])
  );
  return tile;
}

function renderOnlineTable(users: UserProfile[]): HTMLElement {
  if (users.length === 0) {
    return el('p', { className: 'admin-dashboard__empty' }, ['Nobody is using the app right now.']);
  }

  const table = el('table', { className: 'admin-dashboard__table' });
  table.append(
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, ['Organizer']),
        el('th', {}, ['Status']),
        el('th', {}, ['What they\'re doing']),
        el('th', {}, ['Live wallboard?']),
        el('th', {}, ['Online for']),
        el('th', {}, ['Email']),
      ]),
    ])
  );

  const tbody = el('tbody');
  const now = Date.now();
  for (const user of users) {
    tbody.append(
      el('tr', {}, [
        el('td', { className: 'admin-dashboard__organizer' }, [user.organizerName]),
        el('td', {}, ['● Online']),
        el('td', {}, [adminRouteLabel(user.lastRoute)]),
        el('td', {}, [user.publishEnabled ? 'Yes — broadcasting' : 'No']),
        el('td', {}, [formatDurationMs(now - user.lastSeenAt)]),
        el('td', { className: 'admin-dashboard__muted' }, [user.email]),
      ])
    );
  }
  table.append(tbody);
  return table;
}

function renderLiveWallboardsTable(
  sessions: LiveSessionSnapshot[],
  viewerCounts: Record<string, number>
): HTMLElement {
  if (sessions.length === 0) {
    return el('p', { className: 'admin-dashboard__empty' }, ['No live wallboards right now.']);
  }

  const table = el('table', { className: 'admin-dashboard__table' });
  table.append(
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, ['Organizer']),
        el('th', {}, ['Spectators now']),
        el('th', {}, ['Peak viewers']),
        el('th', {}, ['Total unique viewers']),
        el('th', {}, ['Running for']),
        el('th', {}, ['Format']),
      ]),
    ])
  );

  const tbody = el('tbody');
  const now = Date.now();
  for (const session of sessions) {
    tbody.append(
      el('tr', {}, [
        el('td', { className: 'admin-dashboard__organizer' }, [session.organizerName]),
        el('td', {}, [String(viewerCounts[session.publishToken] ?? 0)]),
        el('td', {}, [String(session.viewerStats.peakConcurrent)]),
        el('td', {}, [String(session.viewerStats.totalUnique)]),
        el('td', {}, [formatDurationMs(now - session.viewerStats.publishStartedAt)]),
        el('td', {}, [gameModeLabel(session.gameMode)]),
      ])
    );
  }
  table.append(tbody);
  return table;
}

function buildSponsorSummary(config: SponsorConfig): string {
  return `${config.sponsors.length}/18 · ${config.sponsorsEnabled ? 'on' : 'off'}`;
}

function buildPitchSummary(rollup: WallboardDailyRollup | null): string {
  if (!rollup) return 'No wallboard audience data yet today.';
  return `Today: ${rollup.totalUniqueViewers} unique viewers, peak ${rollup.peakConcurrent} concurrent, ${Math.round(rollup.totalViewMinutes / 60)} hours watched.`;
}

export function renderAdminScreen(container: HTMLElement): void {
  dashboardUnsub?.();
  container.replaceChildren();

  const header = el('header', { className: 'admin-dashboard__header' });
  header.append(
    el('h1', { className: 'screen-title' }, ['Admin']),
    el('span', { className: 'admin-dashboard__live-badge' }, ['● Live'])
  );

  const tilesRow = el('div', { className: 'admin-dashboard__tiles' });
  const tileEls = {
    people: metricTile('People using the app', 0, true),
    spectators: metricTile('Watching a live wallboard', 0, true),
    liveBoards: metricTile('Live wallboards running', 0, true),
    signupsToday: metricTile('New accounts today', 0),
    appViews: metricTile('App visits today', 0),
    wallboardViews: metricTile('Wallboard opens today', 0),
    totalAccounts: metricTile('Total accounts', 0),
    active24h: metricTile('Active in last 24h', 0),
    new7d: metricTile('New accounts (7 days)', 0),
    peakToday: metricTile('Peak wallboard viewers today', 0),
    sponsors: metricTile('Sponsors', '0/18'),
  };

  tilesRow.append(
    tileEls.people,
    tileEls.spectators,
    tileEls.liveBoards,
    tileEls.signupsToday,
    tileEls.appViews,
    tileEls.wallboardViews
  );

  const onlineCount = el('span', { className: 'admin-dashboard__count-badge' }, ['0 people using the app']);
  const onlineBody = el('div', { className: 'admin-dashboard__section-body' });
  const onlineSection = el('section', { className: 'admin-dashboard__section' }, [
    el('h2', { className: 'admin-dashboard__section-title' }, ['Who\'s using the app', onlineCount]),
    el('p', { className: 'admin-dashboard__section-subtitle' }, [
      'Everyone currently signed in across the whole platform — listed by organizer name.',
    ]),
    onlineBody,
  ]);

  const wallboardBody = el('div', { className: 'admin-dashboard__section-body' });
  const wallboardSection = el('section', { className: 'admin-dashboard__section' }, [
    el('h2', { className: 'admin-dashboard__section-title' }, ['Live wallboards']),
    el('p', { className: 'admin-dashboard__section-subtitle' }, [
      'Organizers broadcasting their queue to a public link right now.',
    ]),
    wallboardBody,
  ]);

  const verifiedTile = el('div', { className: 'admin-dashboard__tile admin-dashboard__tile--verified' });
  verifiedTile.append(
    el('div', { className: 'admin-dashboard__tile-value', id: 'admin-verified-count' }, ['0']),
    el('div', { className: 'admin-dashboard__tile-label' }, ['Verified accounts']),
    el('p', { className: 'admin-dashboard__tile-note', id: 'admin-verified-note' }, [''])
  );

  const glanceTiles = el('div', { className: 'admin-dashboard__tiles admin-dashboard__tiles--secondary' });
  glanceTiles.append(
    verifiedTile,
    tileEls.totalAccounts,
    tileEls.active24h,
    tileEls.new7d,
    tileEls.peakToday,
    tileEls.sponsors
  );

  const signupsTable = el('div');
  const pitchLine = el('p', { className: 'admin-dashboard__pitch' }, ['']);
  const copyPitchBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Copy pitch summary']);
  const exportUsersBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Export users CSV']);
  const exportWallboardBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, [
    'Export wallboard CSV',
  ]);
  const sponsorLink = el('a', { href: '#', className: 'admin-dashboard__settings-link' }, [
    'Open sponsor settings',
  ]);
  sponsorLink.addEventListener('click', (e) => {
    e.preventDefault();
    appRouter.navigate('settings');
  });

  const pastDetails = el('details', { className: 'admin-dashboard__past' });
  pastDetails.append(
    el('summary', { className: 'admin-dashboard__section-title' }, ['Past activity & exports']),
    el('p', { className: 'admin-dashboard__section-subtitle' }, [
      'Historical trends and data you can share with sponsors.',
    ]),
    signupsTable,
    pitchLine,
    el('div', { className: 'admin-dashboard__export-actions' }, [
      copyPitchBtn,
      exportUsersBtn,
      exportWallboardBtn,
      sponsorLink,
    ])
  );

  const pastSection = el('section', { className: 'admin-dashboard__section' }, [pastDetails]);

  const footer = el('footer', { className: 'admin-dashboard__footer' });
  const projectId = getFirebaseConfig()?.projectId ?? '—';
  footer.textContent = `App v${APP_VERSION} · Firebase ${projectId.slice(0, 4)}…`;

  container.append(
    header,
    el('section', { className: 'admin-dashboard__section' }, [
      el('h2', { className: 'admin-dashboard__section-title' }, ['Right now']),
      el('p', { className: 'admin-dashboard__section-subtitle' }, [
        'What\'s happening across Dink Syndicate this moment — all users, all sessions.',
      ]),
      tilesRow,
    ]),
    onlineSection,
    wallboardSection,
    el('section', { className: 'admin-dashboard__section' }, [
      el('h2', { className: 'admin-dashboard__section-title' }, ['Today at a glance']),
      el('p', { className: 'admin-dashboard__section-subtitle' }, [
        'Summary stats — updates when daily totals or user registry changes.',
      ]),
      glanceTiles,
    ]),
    pastSection,
    footer
  );

  let allUsers: UserProfile[] = [];
  let sponsorConfig: SponsorConfig = { sponsorsEnabled: false, sponsors: [], updatedAt: 0 };
  let latestSessions: LiveSessionSnapshot[] = [];
  let latestCounts: Record<string, number> = {};

  sponsorConfigService.subscribe((config) => {
    sponsorConfig = config;
    tileEls.sponsors.querySelector('.admin-dashboard__tile-value')!.textContent =
      buildSponsorSummary(config);
  });

  const updateSignupsTable = (): void => {
    const recent = [...allUsers].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    signupsTable.replaceChildren();
    if (recent.length === 0) {
      signupsTable.append(el('p', { className: 'admin-dashboard__empty' }, ['No sign-ups yet.']));
      return;
    }
    const table = el('table', { className: 'admin-dashboard__table' });
    table.append(
      el('thead', {}, [
        el('tr', {}, [
          el('th', {}, ['Organizer']),
          el('th', {}, ['Email']),
          el('th', {}, ['Verified']),
          el('th', {}, ['Signed up']),
        ]),
      ])
    );
    const tbody = el('tbody');
    for (const user of recent) {
      tbody.append(
        el('tr', {}, [
          el('td', {}, [user.organizerName]),
          el('td', {}, [user.email]),
          el('td', {}, [user.emailVerified ? 'Yes' : 'No']),
          el('td', {}, [formatRelativeTime(user.createdAt)]),
        ])
      );
    }
    table.append(tbody);
    signupsTable.append(table);
  };

  let latestWallboardRollup: WallboardDailyRollup | null = null;

  exportUsersBtn.addEventListener('click', () => {
    const rows = allUsers.map((u) =>
      [u.organizerName, u.email, u.emailVerified ? 'yes' : 'no', new Date(u.createdAt).toISOString()].join(',')
    );
    const csv = ['organizer,email,verified,signed_up', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dink-syndicate-users.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  copyPitchBtn.addEventListener('click', async () => {
    const text = buildPitchSummary(latestWallboardRollup);
    try {
      await navigator.clipboard.writeText(text);
      copyPitchBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyPitchBtn.textContent = 'Copy pitch summary';
      }, 2000);
    } catch {
      copyPitchBtn.textContent = 'Copy failed';
    }
  });

  exportWallboardBtn.addEventListener('click', () => {
    const rollup = latestWallboardRollup;
    const rows = rollup
      ? [
          [
            rollup.date,
            rollup.totalUniqueViewers,
            rollup.peakConcurrent,
            rollup.totalViewMinutes,
            rollup.sessionsPublished,
          ].join(','),
        ]
      : [];
    const csv = ['date,unique_viewers,peak_concurrent,view_minutes,sessions_published', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dink-syndicate-wallboard-audience.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  dashboardUnsub = subscribeAdminDashboard({
    onOnlineUsers: (users) => {
      onlineCount.textContent = `${users.length} people using the app`;
      tileEls.people.querySelector('.admin-dashboard__tile-value')!.textContent = String(users.length);
      onlineBody.replaceChildren(renderOnlineTable(users));
    },
    onAllUsers: (users) => {
      allUsers = users;
      const verified = users.filter((u) => u.emailVerified).length;
      const pending = users.length - verified;
      verifiedTile.querySelector('#admin-verified-count')!.textContent = String(verified);
      verifiedTile.querySelector('#admin-verified-note')!.textContent =
        pending > 0 ? `${pending} accounts pending email verification` : 'Email confirmed or signed in with Google';
      tileEls.totalAccounts.querySelector('.admin-dashboard__tile-value')!.textContent = String(users.length);
      const dayAgo = Date.now() - 86_400_000;
      const weekAgo = Date.now() - 7 * 86_400_000;
      tileEls.active24h.querySelector('.admin-dashboard__tile-value')!.textContent = String(
        users.filter((u) => u.lastSeenAt >= dayAgo).length
      );
      tileEls.new7d.querySelector('.admin-dashboard__tile-value')!.textContent = String(
        users.filter((u) => u.createdAt >= weekAgo).length
      );
      tileEls.sponsors.querySelector('.admin-dashboard__tile-value')!.textContent =
        buildSponsorSummary(sponsorConfig);
      updateSignupsTable();
    },
    onLiveSessions: (sessions) => {
      latestSessions = sessions;
      tileEls.liveBoards.querySelector('.admin-dashboard__tile-value')!.textContent = String(sessions.length);
      wallboardBody.replaceChildren(renderLiveWallboardsTable(sessions, latestCounts));
    },
    onViewerCounts: (counts) => {
      latestCounts = counts;
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      tileEls.spectators.querySelector('.admin-dashboard__tile-value')!.textContent = String(total);
      wallboardBody.replaceChildren(renderLiveWallboardsTable(latestSessions, latestCounts));
    },
    onTodayRollup: (rollup: AdminDailyRollup | null) => {
      tileEls.signupsToday.querySelector('.admin-dashboard__tile-value')!.textContent = String(rollup?.newSignUps ?? 0);
      tileEls.appViews.querySelector('.admin-dashboard__tile-value')!.textContent = String(rollup?.mainAppPageViews ?? 0);
      tileEls.wallboardViews.querySelector('.admin-dashboard__tile-value')!.textContent = String(
        rollup?.wallboardPageViews ?? 0
      );
    },
    onWallboardRollup: (rollup: WallboardDailyRollup | null) => {
      latestWallboardRollup = rollup;
      tileEls.peakToday.querySelector('.admin-dashboard__tile-value')!.textContent = String(rollup?.peakConcurrent ?? 0);
      pitchLine.textContent = buildPitchSummary(rollup);
    },
  });
}

export function teardownAdminScreen(): void {
  dashboardUnsub?.();
  dashboardUnsub = null;
}
