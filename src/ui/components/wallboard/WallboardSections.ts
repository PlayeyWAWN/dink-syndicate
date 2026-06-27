import { el } from '@/lib/dom-utils';
import { formatMatchDuration, mountLiveTimers } from '@/lib/match-timer';
import { splitTeams } from '@/lib/format-utils';
import { paginateItems } from '@/modules/stats/MatchHistoryService';
import { PublicMatch, PublicPlayer, PublicQueueEntry, PublicRankingRow, SponsorConfig, WALLBOARD_MATCH_HISTORY_PAGE_SIZE } from '@/types/live';
import { renderWallboardMatchCourtBoard } from '@/ui/components/wallboard/WallboardMatchCourtBoard';
import {
  findPublicPlayer,
  renderWallboardPlayerChip,
} from '@/ui/components/wallboard/wallboard-player-chip';
import {
  processWallboardRankAlerts,
} from '@/ui/components/wallboard/wallboard-rank-alerts';

function playerName(id: string, players: PublicPlayer[]): string {
  return findPublicPlayer(players, id)?.name ?? 'Unknown';
}

function teamAvgGamesPublic(
  playerIds: string[],
  players: PublicPlayer[],
  team: 'A' | 'B'
): number {
  const { teamA, teamB } = splitTeams(playerIds);
  const ids = team === 'A' ? teamA : teamB;
  if (ids.length === 0) return 0;
  const total = ids.reduce(
    (sum, id) => sum + (findPublicPlayer(players, id)?.gamesPlayed ?? 0),
    0
  );
  return total / ids.length;
}

function teamTotalGamesPublic(
  playerIds: string[],
  players: PublicPlayer[],
  team: 'A' | 'B'
): number {
  const { teamA, teamB } = splitTeams(playerIds);
  const ids = team === 'A' ? teamA : teamB;
  return ids.reduce(
    (sum, id) => sum + (findPublicPlayer(players, id)?.gamesPlayed ?? 0),
    0
  );
}

function buildPlayerLookup(
  snapshotPlayers: PublicPlayer[] | undefined,
  matches: PublicMatch[],
  rankings: PublicRankingRow[]
): PublicPlayer[] {
  const map = new Map<string, PublicPlayer>();
  for (const player of snapshotPlayers ?? []) {
    map.set(player.id, { ...player });
  }
  for (const row of rankings) {
    const existing = map.get(row.playerId);
    map.set(row.playerId, {
      id: row.playerId,
      name: row.name,
      gender: existing?.gender,
      duprDoublesRating: row.duprDoublesRating ?? existing?.duprDoublesRating,
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      losses: row.losses,
    });
  }
  for (const match of matches) {
    for (const id of match.playerIds) {
      if (!map.has(id)) {
        map.set(id, { id, name: id, gamesPlayed: 0, wins: 0, losses: 0 });
      }
    }
  }
  return [...map.values()];
}

export function renderWallboardHeader(organizerName: string, updatedAt: number): HTMLElement {
  const now = new Date();
  const header = el('header', { className: 'live-wallboard__header' });
  header.append(
    el('img', {
      className: 'live-wallboard__logo',
      src: '/images/logo.webp',
      alt: 'Dink Syndicate',
      width: '160',
      height: '160',
    }),
    el('h1', { className: 'live-wallboard__organizer' }, [organizerName]),
    el('p', { className: 'live-wallboard__tagline' }, ['Live Wallboard']),
    el('p', { className: 'live-wallboard__date', id: 'wallboard-date' }, [
      formatWallboardDate(now),
    ]),
    el('div', { className: 'live-wallboard__status-pill', role: 'status' }, [
      el('span', { className: 'live-wallboard__clock', id: 'wallboard-clock' }, [
        now.toLocaleTimeString(),
      ]),
      el('span', { className: 'live-wallboard__status-sep' }, [' · ']),
      el('span', {
        className: 'live-wallboard__updated',
        id: 'wallboard-updated',
        'data-updated-at': String(updatedAt),
      }, [`Updated ${formatMatchDuration(Date.now() - updatedAt)} ago`]),
    ])
  );
  return header;
}

function formatWallboardDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatMatchFormatLabel(format: string): string {
  if (format === 'mixed_doubles') return 'Mixed doubles';
  if (format === 'same_gender_doubles') return 'Same gender';
  if (format === 'singles') return 'Singles';
  return 'Doubles';
}

export function renderWallboardActiveMatches(
  matches: PublicMatch[],
  players: PublicPlayer[]
): HTMLElement {
  const section = el('section', { className: 'live-wallboard__section live-wallboard__section--active' });
  section.append(el('h2', { className: 'live-wallboard__section-title' }, ['Active Matches']));

  if (matches.length === 0) {
    section.append(el('p', { className: 'live-wallboard__empty' }, ['No matches in progress.']));
    return section;
  }

  const sorted = [...matches].sort((a, b) =>
    a.courtLabel.localeCompare(b.courtLabel, undefined, { numeric: true })
  );

  const list = el('div', { className: 'live-wallboard__active-list active-match-list' });
  for (const match of sorted) {
    const startedAt = match.startedAt ?? Date.now();
    const card = el('article', {
      className: 'live-wallboard__active-card active-match-card smash-active-match-card',
    });

    const header = el('div', { className: 'active-match-card__header-bar' });
    header.append(
      el('div', { className: 'active-match-card__header-main' }, [
        el('div', { className: 'active-match-card__court-name' }, [match.courtLabel]),
        el('div', { className: 'active-match-card__header-meta' }, [
          el('span', { className: 'active-match-card__format' }, [
            formatMatchFormatLabel(match.format),
          ]),
          el('span', {
            className: 'match-timer active-match-card__timer',
            'data-started-at': String(startedAt),
          }, [formatMatchDuration(Date.now() - startedAt)]),
        ]),
      ])
    );

    card.append(
      header,
      renderWallboardMatchCourtBoard({
        playerIds: match.playerIds,
        players,
        courtLabel: match.courtLabel,
      })
    );
    list.append(card);
  }
  section.append(list);
  return section;
}

function normalizeSponsorHref(linkUrl: string | undefined): string | undefined {
  const trimmed = linkUrl?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function renderWallboardSponsors(config: SponsorConfig): HTMLElement | null {
  if (!config.sponsorsEnabled || config.sponsors.length === 0) return null;

  const section = el('section', { className: 'live-wallboard__section live-wallboard__sponsors' });
  section.append(el('h2', { className: 'live-wallboard__section-title' }, ['Sponsors']));

  const grid = el('div', { className: 'live-wallboard__sponsor-grid' });
  for (const sponsor of config.sponsors.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const img = el('img', {
      className: 'live-wallboard__sponsor-logo',
      src: sponsor.logoUrl,
      alt: sponsor.name,
      loading: 'lazy',
    });

    const href = normalizeSponsorHref(sponsor.linkUrl);
    if (href) {
      const link = el('a', {
        className: 'live-wallboard__sponsor-link',
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      link.append(img);
      grid.append(link);
    } else {
      grid.append(el('div', { className: 'live-wallboard__sponsor-item' }, [img]));
    }
  }

  section.append(grid);
  return section;
}

export function renderWallboardQueue(
  queueNext: PublicQueueEntry[],
  players: PublicPlayer[]
): HTMLElement {
  const section = el('section', { className: 'live-wallboard__section live-wallboard__section--queue' });
  section.append(el('h2', { className: 'live-wallboard__section-title' }, ['Up next']));

  if (queueNext.length === 0) {
    section.append(el('p', { className: 'live-wallboard__empty' }, ['Queue is empty.']));
    return section;
  }

  const list = el('div', { className: 'live-wallboard__queue-list match-queue-list' });
  for (const entry of queueNext) {
    const team1Total = teamTotalGamesPublic(entry.playerIds, players, 'A');
    const team2Total = teamTotalGamesPublic(entry.playerIds, players, 'B');
    const { teamA, teamB } = splitTeams(entry.playerIds);

    const card = el('article', { className: 'match-queue-card live-wallboard__queue-card' });
    const row = el('div', { className: 'live-wallboard__queue-card-row' });
    row.append(
      el('span', { className: 'match-queue-card__number live-wallboard__queue-number' }, [
        String(entry.position),
      ])
    );

    const body = el('div', { className: 'live-wallboard__queue-card-body' });
    body.append(
      el('div', { className: 'live-wallboard__queue-summary' }, [
        `Queue · Team 1: ${team1Total}g total · Team 2: ${team2Total}g total`,
      ])
    );

    const vsLayout = el('div', { className: 'match-queue-card__vs-layout live-wallboard__queue-vs' });
    for (const [team, ids] of [
      ['A', teamA] as const,
      ['B', teamB] as const,
    ]) {
      if (team === 'B') {
        vsLayout.append(el('div', { className: 'match-queue-card__vs live-wallboard__queue-vs-badge' }, ['vs']));
      }
      const side = el('div', { className: 'match-queue-card__team-side' });
      side.append(
        el('div', {
          className: `match-queue-card__team-label match-queue-card__team-label--${team === 'A' ? 'team1' : 'team2'}`,
        }, [team === 'A' ? 'Team 1' : 'Team 2']),
        el('div', { className: 'match-queue-card__team-avg' }, [
          `Avg. ${teamAvgGamesPublic(entry.playerIds, players, team).toFixed(1)} games`,
        ])
      );
      const playersRow = el('div', { className: 'match-queue-card__team-players' });
      for (const id of ids) {
        playersRow.append(renderWallboardPlayerChip(findPublicPlayer(players, id), team));
      }
      side.append(playersRow);
      vsLayout.append(side);
    }
    body.append(vsLayout);

    if (entry.queuedAt) {
      const wait = el('div', { className: 'live-wallboard__queue-wait-label' }, ['IN QUEUE ']);
      wait.append(
        el('span', {
          className: 'match-timer live-wallboard__queue-wait',
          'data-queued-at': String(entry.queuedAt),
        }, [formatMatchDuration(Date.now() - entry.queuedAt)])
      );
      body.append(wait);
    }

    row.append(body);
    card.append(row);
    list.append(card);
  }
  section.append(list);
  return section;
}

function buildTopTenHighlight(rankings: PublicRankingRow[]): string | null {
  const highlight = processWallboardRankAlerts(rankings);
  return highlight?.message ?? null;
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'live-wallboard__rank-badge--gold';
  if (rank === 2) return 'live-wallboard__rank-badge--silver';
  if (rank === 3) return 'live-wallboard__rank-badge--bronze';
  return 'live-wallboard__rank-badge--default';
}

function winPct(wins: number, gamesPlayed: number): string {
  if (gamesPlayed <= 0) return '—';
  return `${Math.round((wins / gamesPlayed) * 100)}%`;
}

export function renderWallboardRankings(rankings: PublicRankingRow[]): HTMLElement {
  const section = el('section', { className: 'live-wallboard__section live-wallboard__section--rankings' });
  section.append(
    el('h2', { className: 'live-wallboard__section-title' }, ['Current Top 10']),
    el('p', { className: 'live-wallboard__section-subtitle' }, [
      'Rankings update after each completed match.',
    ])
  );

  if (rankings.length === 0) {
    section.append(el('p', { className: 'live-wallboard__empty' }, ['No rankings yet.']));
    return section;
  }

  const highlight = buildTopTenHighlight(rankings);
  const highlightBanner = el('div', {
    className: 'live-wallboard__rank-highlight',
    ...(highlight ? {} : { 'aria-hidden': 'true' }),
  });
  if (highlight) {
    highlightBanner.textContent = highlight;
  } else {
    highlightBanner.classList.add('is-empty');
  }
  section.append(highlightBanner);

  const table = el('table', { className: 'live-wallboard__rankings' });
  const thead = el('thead');
  thead.append(
    el('tr', {}, [
      el('th', {}, ['Rank']),
      el('th', {}, ['Player']),
      el('th', {}, ['W']),
      el('th', {}, ['L']),
      el('th', {}, ['Games']),
      el('th', {}, ['Win %']),
    ])
  );
  table.append(thead);

  const tbody = el('tbody');
  for (const row of rankings) {
    const tr = el('tr');
    tr.append(
      el('td', { className: 'live-wallboard__rank-cell' }, [
        el('span', { className: `live-wallboard__rank-badge ${rankBadgeClass(row.rank)}` }, [
          String(row.rank),
        ]),
      ]),
      el('td', { className: 'live-wallboard__rank-player' }, [row.name]),
      el('td', {}, [String(row.wins)]),
      el('td', {}, [String(row.losses)]),
      el('td', {}, [String(row.gamesPlayed)]),
      el('td', {}, [winPct(row.wins, row.gamesPlayed)])
    );
    tbody.append(tr);
  }
  table.append(tbody);
  const tableWrap = el('div', { className: 'live-wallboard__rankings-wrap' });
  tableWrap.append(table);
  section.append(tableWrap);
  section.append(
    el('p', { className: 'live-wallboard__rankings-footer' }, [
      'Keep playing and climb the Top 10!',
    ])
  );
  return section;
}

export function renderWallboardMatchHistory(
  completedMatches: PublicMatch[],
  players: PublicPlayer[],
  onPageChange: (page: number) => void,
  currentPage: number
): HTMLElement {
  const section = el('section', {
    className: 'live-wallboard__section live-wallboard__section--history',
  });
  section.append(el('h2', { className: 'live-wallboard__section-title' }, ['Recent results']));

  if (completedMatches.length === 0) {
    section.append(el('p', { className: 'live-wallboard__empty' }, ['No completed matches yet.']));
    return section;
  }

  const sorted = [...completedMatches].sort(
    (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
  );

  const pageResult = paginateItems(sorted, currentPage, WALLBOARD_MATCH_HISTORY_PAGE_SIZE);
  const list = el('div', { className: 'live-wallboard__history-list' });

  for (const match of pageResult.items) {
    const { teamA, teamB } = splitTeams(match.playerIds);
    const winners = new Set(match.winnerPlayerIds);
    const winnerIsA = teamA.length > 0 && teamA.every((id) => winners.has(id));
    const winnerIsB = teamB.length > 0 && teamB.every((id) => winners.has(id));
    const winnerTeam = winnerIsA ? 'A' : winnerIsB ? 'B' : null;
    const winnerNames = winnerTeam === 'A'
      ? teamA.map((id) => playerName(id, players)).join(' & ')
      : winnerTeam === 'B'
        ? teamB.map((id) => playerName(id, players)).join(' & ')
        : '—';
    const loserNames = winnerTeam === 'A'
      ? teamB.map((id) => playerName(id, players)).join(' & ')
      : winnerTeam === 'B'
        ? teamA.map((id) => playerName(id, players)).join(' & ')
        : '—';
    const winnerLabel = winnerTeam === 'A' ? 'Team 1' : winnerTeam === 'B' ? 'Team 2' : 'Match';
    const finishedAt = match.completedAt
      ? new Date(match.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

    const card = el('article', { className: 'live-wallboard__history-card' });
    card.append(
      el('p', { className: 'live-wallboard__history-winner' }, [
        `${winnerLabel} wins: ${winnerNames}`,
      ]),
      el('p', { className: 'live-wallboard__history-defeated' }, [`Defeated: ${loserNames}`])
    );
    if (finishedAt) {
      card.append(
        el('p', { className: 'live-wallboard__history-time' }, [`Finished ${finishedAt}`])
      );
    }
    list.append(card);
  }

  section.append(list);

  const pager = el('div', { className: 'live-wallboard__pager' });
  const prev = el('button', {
    type: 'button',
    className: 'btn btn-secondary',
    disabled: currentPage <= 0 ? 'true' : undefined,
  }, ['Prev']);
  const next = el('button', {
    type: 'button',
    className: 'btn btn-secondary',
    disabled: currentPage >= pageResult.totalPages - 1 ? 'true' : undefined,
  }, ['Next']);

  prev.addEventListener('click', () => onPageChange(currentPage - 1));
  next.addEventListener('click', () => onPageChange(currentPage + 1));

  pager.append(
    prev,
    el('span', { className: 'live-wallboard__pager-meta' }, [
      `Showing ${pageResult.rangeStart}–${pageResult.rangeEnd} of ${pageResult.totalItems} · Page ${pageResult.page + 1} of ${pageResult.totalPages}`,
    ]),
    next
  );
  section.append(pager);

  return section;
}

export function resolveWallboardPlayers(
  snapshotPlayers: PublicPlayer[] | undefined,
  activeMatches: PublicMatch[],
  completedMatches: PublicMatch[],
  rankings: PublicRankingRow[]
): PublicPlayer[] {
  return buildPlayerLookup(snapshotPlayers, [...activeMatches, ...completedMatches], rankings);
}

export function mountWallboardTimers(root: HTMLElement): void {
  mountLiveTimers(root);
  const tickClock = (): void => {
    const now = new Date();
    const date = root.querySelector('#wallboard-date');
    if (date) date.textContent = formatWallboardDate(now);
    const clock = root.querySelector('#wallboard-clock');
    if (clock) clock.textContent = now.toLocaleTimeString();
    const updated = root.querySelector('#wallboard-updated');
    const ts = updated?.getAttribute('data-updated-at');
    if (updated && ts) {
      updated.textContent = `Updated ${formatMatchDuration(Date.now() - Number(ts))} ago`;
    }
  };
  tickClock();
  window.setInterval(tickClock, 1000);
}
