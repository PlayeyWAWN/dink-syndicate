import { el } from '@/lib/dom-utils';
import { formatMatchDuration, mountLiveTimers } from '@/lib/match-timer';
import { splitTeams } from '@/lib/format-utils';
import { paginateItems } from '@/modules/stats/MatchHistoryService';
import { PublicMatch, PublicPlayer, PublicQueueEntry, PublicRankingRow, SponsorConfig, WALLBOARD_MATCH_HISTORY_PAGE_SIZE } from '@/types/live';
import { renderWallboardMatchCourtBoard } from '@/ui/components/wallboard/WallboardMatchCourtBoard';

function playerName(id: string, players: PublicPlayer[]): string {
  return players.find((p) => p.id === id)?.name ?? 'Unknown';
}

function buildPlayerLookup(matches: PublicMatch[], rankings: PublicRankingRow[]): PublicPlayer[] {
  const map = new Map<string, PublicPlayer>();
  for (const row of rankings) {
    map.set(row.playerId, {
      id: row.playerId,
      name: row.name,
      duprDoublesRating: row.duprDoublesRating,
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
  const header = el('header', { className: 'live-wallboard__header' });
  header.append(
    el('img', { className: 'live-wallboard__logo', src: '/images/logo.webp', alt: 'Dink Syndicate' }),
    el('div', { className: 'live-wallboard__header-text' }, [
      el('h1', { className: 'live-wallboard__organizer' }, [organizerName]),
      el('p', { className: 'live-wallboard__clock', id: 'wallboard-clock' }, [
        new Date().toLocaleTimeString(),
      ]),
      el('p', {
        className: 'live-wallboard__updated',
        id: 'wallboard-updated',
        'data-updated-at': String(updatedAt),
      }, [`Updated ${formatMatchDuration(Date.now() - updatedAt)} ago`]),
    ])
  );
  return header;
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

    if (sponsor.linkUrl) {
      const link = el('a', {
        className: 'live-wallboard__sponsor-link',
        href: sponsor.linkUrl,
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

export function renderWallboardQueue(queueNext: PublicQueueEntry[]): HTMLElement {
  const section = el('section', { className: 'live-wallboard__section' });
  section.append(el('h2', { className: 'live-wallboard__section-title' }, ['Next in Queue']));

  if (queueNext.length === 0) {
    section.append(el('p', { className: 'live-wallboard__empty' }, ['Queue is empty.']));
    return section;
  }

  const list = el('ol', { className: 'live-wallboard__queue-list' });
  for (const entry of queueNext) {
    const item = el('li', { className: 'live-wallboard__queue-item' });
    item.append(
      el('span', { className: 'live-wallboard__queue-pos' }, [String(entry.position)]),
      el('span', { className: 'live-wallboard__queue-label' }, [entry.label])
    );
    if (entry.queuedAt) {
      item.append(
        el('span', {
          className: 'match-timer live-wallboard__queue-wait',
          'data-queued-at': String(entry.queuedAt),
        }, [formatMatchDuration(Date.now() - entry.queuedAt)])
      );
    }
    list.append(item);
  }
  section.append(list);
  return section;
}

function deltaBadge(delta: PublicRankingRow['delta']): HTMLElement | null {
  if (!delta || delta === 'same') return null;
  const labels = { up: '↑', down: '↓', new: 'NEW' };
  return el('span', { className: `live-wallboard__delta live-wallboard__delta--${delta}` }, [
    labels[delta],
  ]);
}

export function renderWallboardRankings(rankings: PublicRankingRow[]): HTMLElement {
  const section = el('section', { className: 'live-wallboard__section' });
  section.append(el('h2', { className: 'live-wallboard__section-title' }, ['Top 10 Live Rankings']));

  if (rankings.length === 0) {
    section.append(el('p', { className: 'live-wallboard__empty' }, ['No rankings yet.']));
    return section;
  }

  const table = el('table', { className: 'live-wallboard__rankings' });
  const thead = el('thead');
  thead.append(
    el('tr', {}, [
      el('th', {}, ['#']),
      el('th', {}, ['Player']),
      el('th', {}, ['Pts']),
      el('th', {}, ['W-L']),
      el('th', {}, ['']),
    ])
  );
  table.append(thead);

  const tbody = el('tbody');
  for (const row of rankings) {
    const tr = el('tr');
    const delta = deltaBadge(row.delta);
    tr.append(
      el('td', {}, [String(row.rank)]),
      el('td', {}, [row.name]),
      el('td', {}, [String(row.points)]),
      el('td', {}, [`${row.wins}-${row.losses}`]),
      el('td', {}, delta ? [delta] : [])
    );
    tbody.append(tr);
  }
  table.append(tbody);
  section.append(table);
  return section;
}

export function renderWallboardMatchHistory(
  completedMatches: PublicMatch[],
  players: PublicPlayer[],
  onPageChange: (page: number) => void,
  currentPage: number
): HTMLElement {
  const section = el('section', { className: 'live-wallboard__section' });
  section.append(el('h2', { className: 'live-wallboard__section-title' }, ['Match History']));

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
    const winnerLabel = winnerIsA
      ? teamA.map((id) => playerName(id, players)).join(' & ')
      : winnerIsB
        ? teamB.map((id) => playerName(id, players)).join(' & ')
        : '—';

    const card = el('article', { className: 'live-wallboard__history-card' });
    card.append(
      el('div', { className: 'live-wallboard__history-label' }, [
        `${teamA.map((id) => playerName(id, players)).join(' & ')} vs ${teamB.map((id) => playerName(id, players)).join(' & ')}`,
      ]),
      el('div', { className: 'live-wallboard__history-winner' }, [`Winner: ${winnerLabel}`])
    );
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
  activeMatches: PublicMatch[],
  completedMatches: PublicMatch[],
  rankings: PublicRankingRow[]
): PublicPlayer[] {
  return buildPlayerLookup([...activeMatches, ...completedMatches], rankings);
}

export function mountWallboardTimers(root: HTMLElement): void {
  mountLiveTimers(root);
  const tickClock = (): void => {
    const clock = root.querySelector('#wallboard-clock');
    if (clock) clock.textContent = new Date().toLocaleTimeString();
    const updated = root.querySelector('#wallboard-updated');
    const ts = updated?.getAttribute('data-updated-at');
    if (updated && ts) {
      updated.textContent = `Updated ${formatMatchDuration(Date.now() - Number(ts))} ago`;
    }
  };
  tickClock();
  window.setInterval(tickClock, 1000);
}
