import { el } from '@/lib/dom-utils';
import {
  getLadderUpNextPlayerIds,
  sortWaitingPoolByFairness,
} from '@/modules/game-mode/ladderWaterfallMode';
import { Court } from '@/types/court';
import { ensureLadderWaterfallState } from '@/types/ladder-waterfall';
import { Player } from '@/types/player';
import { Match, QueueState } from '@/types/queue';
import { genderAppIconId, mountAppIcon } from '@/ui/icons/app-icons';

export interface LadderWaterfallSidebarOptions {
  queueState: QueueState;
  courts: Court[];
  players: Player[];
  manualMode?: boolean;
  selectedPoolPlayerId?: string | null;
  onSelectPoolPlayer?: (playerId: string) => void;
}

function formatCourtHeading(court: Court): string {
  const label = court.label.trim();
  return /^\d+$/.test(label) ? `Court ${label}` : label;
}

function playerName(playerId: string, players: Player[]): string {
  return players.find((player) => player.id === playerId)?.name ?? 'Unknown';
}

function playerGames(playerId: string, players: Player[]): number {
  return players.find((player) => player.id === playerId)?.gamesPlayed ?? 0;
}

function playerGender(playerId: string, players: Player[]): 'male' | 'female' {
  const gender = players.find((player) => player.id === playerId)?.gender;
  return gender === 'female' ? 'female' : 'male';
}

function renderPlayerRow(
  playerId: string,
  players: Player[],
  status: 'playing' | 'bench' | 'pool',
  options: { upNext?: boolean; selected?: boolean; onSelect?: () => void } = {}
): HTMLElement {
  const gender = playerGender(playerId, players);
  const selectable = status === 'pool' && Boolean(options.onSelect);
  const row = el('div', {
    className: [
      'ladder-sidebar__player',
      `ladder-sidebar__player--${status}`,
      options.upNext ? 'ladder-sidebar__player--up-next' : '',
      options.selected ? 'ladder-sidebar__player--selected' : '',
      selectable ? 'ladder-sidebar__player--selectable' : '',
    ]
      .filter(Boolean)
      .join(' '),
    ...(selectable
      ? {
          role: 'button',
          tabIndex: '0',
          title: 'Tap to select, then tap an open bench slot',
        }
      : {}),
  });
  const icon = el('div', { className: 'ladder-sidebar__player-icon', 'aria-hidden': 'true' });
  mountAppIcon(icon, genderAppIconId(gender));

  const nameEl = el('span', { className: 'ladder-sidebar__player-name' }, [
    playerName(playerId, players),
  ]);

  row.append(icon, nameEl);

  if (status === 'pool' || status === 'bench') {
    row.append(
      el('span', { className: 'ladder-sidebar__player-games' }, [
        `${playerGames(playerId, players)}g`,
      ])
    );
  }

  if (options.upNext) {
    row.append(el('span', { className: 'ladder-sidebar__up-next-badge' }, ['Up next']));
  }

  if (status === 'playing') {
    row.append(
      el('span', { className: 'ladder-sidebar__player-hint ladder-sidebar__player-hint--up', title: 'Win → move up' }, ['↑']),
      el('span', { className: 'ladder-sidebar__player-hint ladder-sidebar__player-hint--down', title: 'Loss → move down' }, ['↓'])
    );
  }

  if (selectable && options.onSelect) {
    row.addEventListener('click', options.onSelect);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        options.onSelect?.();
      }
    });
  }

  return row;
}

function renderCourtGroup(
  court: Court,
  benchIds: string[],
  activeMatch: Match | undefined,
  players: Player[]
): HTMLElement {
  const group = el('div', { className: 'ladder-sidebar__group' });
  group.append(el('h4', { className: 'ladder-sidebar__group-title' }, [formatCourtHeading(court)]));

  const list = el('div', { className: 'ladder-sidebar__group-list' });

  if (activeMatch) {
    for (const playerId of activeMatch.playerIds) {
      list.append(renderPlayerRow(playerId, players, 'playing'));
    }
  }

  for (const playerId of benchIds) {
    if (activeMatch?.playerIds.includes(playerId)) continue;
    list.append(renderPlayerRow(playerId, players, 'bench'));
  }

  if (list.childElementCount === 0) {
    list.append(el('p', { className: 'ladder-sidebar__empty' }, ['No players']));
  }

  group.append(list);
  return group;
}

/** Waterfall flow sidebar — players grouped by court with movement hints. */
export function renderLadderWaterfallSidebar(options: LadderWaterfallSidebarOptions): HTMLElement {
  const {
    queueState,
    courts,
    players,
    manualMode = true,
    selectedPoolPlayerId = null,
    onSelectPoolPlayer,
  } = options;
  const ladder = ensureLadderWaterfallState(queueState.ladderWaterfall);
  const upNextIds = new Set(getLadderUpNextPlayerIds(queueState, players));
  const sortedPool = sortWaitingPoolByFairness(ladder.waitingPool, players);

  const aside = el('aside', { className: 'ladder-sidebar' });
  aside.append(
    el('h3', { className: 'ladder-sidebar__title' }, ['Waterfall flow']),
    el('p', { className: 'ladder-sidebar__lead' }, [
      'Winners rise toward the top court. Losers drop toward the bottom. ',
      'The waiting pool is ordered by fewest games played — names at the top are up next when a bench slot opens.',
    ])
  );

  const groups = el('div', { className: 'ladder-sidebar__groups' });
  courts.forEach((court) => {
    const benchIds = ladder.benchByCourtId[court.id] ?? [];
    const activeMatch = queueState.activeMatches.find((match) => match.courtId === court.id);
    groups.append(renderCourtGroup(court, benchIds, activeMatch, players));
  });

  if (sortedPool.length > 0) {
    const poolGroup = el('div', { className: 'ladder-sidebar__group ladder-sidebar__group--pool' });
    poolGroup.append(
      el('h4', { className: 'ladder-sidebar__group-title' }, [
        `Waiting pool (${sortedPool.length})`,
      ])
    );

    if (upNextIds.size > 0) {
      poolGroup.append(
        el('p', { className: 'ladder-sidebar__pool-hint' }, [
          `${upNextIds.size} player${upNextIds.size === 1 ? '' : 's'} up next when the next bench slot opens.`,
        ])
      );
    }

    if (onSelectPoolPlayer) {
      poolGroup.append(
        el('p', { className: 'ladder-sidebar__pool-hint ladder-sidebar__pool-hint--manual' }, [
          selectedPoolPlayerId
            ? 'Selected — tap an open bench slot on a court to assign.'
            : 'Tap a player here, then tap an open bench slot after a game finishes.',
        ])
      );
    } else if (!manualMode && sortedPool.length > 0) {
      poolGroup.append(
        el('p', { className: 'ladder-sidebar__pool-hint ladder-sidebar__pool-hint--manual' }, [
          'Turn on Auto-rotation for automatic bench fill, or tap waiting-pool players to assign manually.',
        ])
      );
    }

    const poolList = el('div', { className: 'ladder-sidebar__group-list' });
    for (const playerId of sortedPool) {
      poolList.append(
        renderPlayerRow(playerId, players, 'pool', {
          upNext: upNextIds.has(playerId),
          selected: selectedPoolPlayerId === playerId,
          onSelect: onSelectPoolPlayer ? () => onSelectPoolPlayer(playerId) : undefined,
        })
      );
    }
    poolGroup.append(poolList);
    groups.append(poolGroup);
  }

  aside.append(groups);
  return aside;
}
