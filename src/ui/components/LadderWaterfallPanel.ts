import { el } from '@/lib/dom-utils';
import { LADDER_NOTICE_TTL_MS } from '@/lib/ladder-notice-timer';
import { pickleballIconHtml } from '@/ui/icons/pickleball-icon';
import { useQueueStore } from '@/stores/queueStore';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { useCourtStore } from '@/stores/courtStore';
import { formatLadderStartNotice } from '@/modules/game-mode/ladderStartNotice';
import { Court } from '@/types/court';
import { Player } from '@/types/player';
import { QueueState } from '@/types/queue';
import { ensureLadderWaterfallState } from '@/types/ladder-waterfall';
import { renderRotationControls } from '@/ui/components/RotationControlsPanel';
import {
  canStartLadderMatchOnCourt,
  countTotalLadderWaiting,
  getLadderStartBlockReason,
  LADDER_PLAYERS_PER_COURT,
} from '@/modules/game-mode/ladderWaterfallMode';

export interface LadderWaterfallPanelOptions {
  queueState: QueueState;
  courts: Court[];
  players: Player[];
  activeMatchCount: number;
  onNavigate: () => void;
}

function renderBenchList(playerIds: string[], players: Player[]): HTMLElement {
  const list = el('ol', { className: 'ladder-waterfall__bench-list' });
  if (playerIds.length === 0) {
    list.append(el('li', { className: 'ladder-waterfall__bench-empty' }, ['No players waiting']));
    return list;
  }

  playerIds.forEach((playerId, index) => {
    const name = players.find((player) => player.id === playerId)?.name ?? 'Unknown';
    list.append(
      el('li', { className: 'ladder-waterfall__bench-item' }, [
        el('span', { className: 'ladder-waterfall__bench-position' }, [String(index + 1)]),
        el('span', { className: 'ladder-waterfall__bench-name' }, [name]),
      ])
    );
  });
  return list;
}

function renderRung(
  court: Court,
  rank: number,
  totalCourts: number,
  benchIds: string[],
  players: Player[],
  hasActiveMatch: boolean,
  isReady: boolean
): HTMLElement {
  const isTop = rank === 0;
  const isBottom = rank === totalCourts - 1;

  const rung = el('article', {
    className: `ladder-waterfall__rung${isReady ? ' ladder-waterfall__rung--ready' : ''}`,
  });

  const header = el('div', { className: 'ladder-waterfall__rung-header' });
  const titleWrap = el('div', { className: 'ladder-waterfall__rung-title-wrap' });
  titleWrap.append(el('h3', { className: 'ladder-waterfall__rung-title' }, [court.label]));
  if (isTop) {
    titleWrap.append(
      el('span', { className: 'ladder-waterfall__rung-badge ladder-waterfall__rung-badge--top' }, [
        'Top rung',
      ])
    );
  } else if (isBottom) {
    titleWrap.append(
      el('span', { className: 'ladder-waterfall__rung-badge ladder-waterfall__rung-badge--bottom' }, [
        'Bottom rung',
      ])
    );
  }
  header.append(
    titleWrap,
    el('span', { className: 'ladder-waterfall__rung-count' }, [
      `${benchIds.length}/${LADDER_PLAYERS_PER_COURT} on bench`,
    ])
  );
  rung.append(header);

  if (hasActiveMatch) {
    rung.append(
      el('p', { className: 'ladder-waterfall__rung-status' }, ['Match in progress'])
    );
  }

  rung.append(renderBenchList(benchIds, players));
  return rung;
}

function renderLadderStartNotices(onNavigate: () => void): HTMLElement | null {
  const notices = useQueueUiStore
    .getState()
    .ladderStartNotices.filter(
      (notice) => Date.now() - notice.createdAt < LADDER_NOTICE_TTL_MS
    );

  if (notices.length === 0) {
    return null;
  }

  const wrap = el('div', { className: 'ladder-waterfall__notices', role: 'status' });

  for (const notice of notices) {
    const banner = el('div', { className: 'ladder-waterfall__notice notice-banner notice-banner--ladder' });
    banner.append(
      el('div', { className: 'notice-banner__title' }, ['Bench cleared — game started']),
      el('div', { className: 'notice-banner__body' }, [
        formatLadderStartNotice(notice.courtLabel, notice.playerNames),
        ' Look in Active Matches above.',
      ])
    );

    const dismissBtn = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm ladder-waterfall__notice-dismiss',
      },
      ['Dismiss']
    );
    dismissBtn.addEventListener('click', () => {
      useQueueUiStore.getState().removeLadderStartNotice(notice.id);
      onNavigate();
    });

    const actions = el('div', { className: 'notice-banner__actions' }, [dismissBtn]);
    banner.append(actions);
    wrap.append(banner);
  }

  return wrap;
}

/** Ladder/Waterfall rotation panel — court benches top to bottom with waiting pool. */
export function renderLadderWaterfallPanel(options: LadderWaterfallPanelOptions): HTMLElement {
  const { queueState, courts, players, activeMatchCount, onNavigate } = options;
  const ladder = ensureLadderWaterfallState(queueState.ladderWaterfall);
  const rotationPaused = queueState.rotationPaused === true;
  const blockReason = getLadderStartBlockReason(queueState, courts, activeMatchCount);
  const canStartAny = !rotationPaused && blockReason == null;
  const openCourtCount = courts.filter((court) => !court.activeMatchId).length;

  const section = el('section', { className: 'queue-section queue-section--ladder' });
  section.append(
    el('div', { className: 'queue-section__header' }, [
      el('h2', { className: 'queue-section__title' }, ['Ladder / Waterfall']),
      el('span', { className: 'queue-section__count' }, [String(countTotalLadderWaiting(queueState))]),
    ]),
    el('p', { className: 'screen-lead queue-section__lead' }, [
      'Court 1 is the top rung. After each game, winners move up one court and losers move down. ',
      'Partners split when the next doubles lineup forms.',
    ])
  );

  section.append(renderRotationControls({ onNavigate }));

  const startNotices = renderLadderStartNotices(onNavigate);
  if (startNotices) {
    section.append(startNotices);
  }

  const statsRow = el('div', { className: 'stat-grid queue-section__stats queue-stat-grid' });
  statsRow.append(
    el('div', { className: 'stat-card queue-stat-card' }, [
      el('strong', {}, [String(countTotalLadderWaiting(queueState))]),
      el('span', {}, ['On ladder']),
    ]),
    el('div', { className: 'stat-card queue-stat-card' }, [
      el('strong', {}, [String(ladder.waitingPool.length)]),
      el('span', {}, ['Waiting pool']),
    ]),
    el('div', { className: 'stat-card queue-stat-card' }, [
      el('strong', {}, [String(openCourtCount)]),
      el('span', {}, ['Open courts']),
    ]),
    el('div', { className: 'stat-card queue-stat-card' }, [
      el('strong', {}, [String(courts.length)]),
      el('span', {}, ['Total courts']),
    ])
  );
  section.append(statsRow);

  const ladderList = el('div', { className: 'ladder-waterfall__ladder' });
  courts.forEach((court, rank) => {
    const benchIds = ladder.benchByCourtId[court.id] ?? [];
    const hasActiveMatch = queueState.activeMatches.some((match) => match.courtId === court.id);
    const isReady =
      !hasActiveMatch && canStartLadderMatchOnCourt(queueState, court.id);
    ladderList.append(
      renderRung(court, rank, courts.length, benchIds, players, hasActiveMatch, isReady)
    );
  });
  section.append(ladderList);

  if (ladder.waitingPool.length > 0) {
    const poolSection = el('div', { className: 'ladder-waterfall__pool' });
    poolSection.append(
      el('h3', { className: 'ladder-waterfall__pool-title' }, [
        `Waiting pool (${ladder.waitingPool.length})`,
      ]),
      renderBenchList(ladder.waitingPool, players)
    );
    section.append(poolSection);
  }

  if (blockReason) {
    section.append(
      el('p', {
        className: 'screen-lead ladder-waterfall__status ladder-waterfall__status--blocked',
        role: 'status',
      }, [blockReason])
    );
  }

  const actions = el('div', { className: 'queue-section__actions' });
  const startBtn = el('button', {
    type: 'button',
    className: 'btn btn-success btn-create-match',
    disabled: canStartAny ? undefined : 'true',
  }) as HTMLButtonElement;
  startBtn.innerHTML = `${pickleballIconHtml()}<span>Start ready games</span>`;

  startBtn.addEventListener('click', () => {
    if (useQueueStore.getState().queueState.rotationPaused) {
      alert('Rotation is paused. Tap Resume rotation or stop from Settings when you are done.');
      onNavigate();
      return;
    }

    const liveCourts = useCourtStore.getState().courts;
    const liveState = useQueueStore.getState().queueState;
    const liveBlock = getLadderStartBlockReason(
      liveState,
      liveCourts,
      liveState.activeMatches.length
    );

    if (liveBlock) {
      alert(liveBlock);
      onNavigate();
      return;
    }

    const started = useQueueStore.getState().tryStartLadderMatch();
    if (!started) {
      alert(
        `Could not start a game. Need ${LADDER_PLAYERS_PER_COURT} players on a court bench and an open court.`
      );
    }
    onNavigate();
  });

  actions.append(startBtn);

  if (activeMatchCount > 0) {
    actions.append(
      el('p', { className: 'screen-lead ladder-waterfall__hint' }, [
        'Recording a winner moves players up or down the ladder and auto-starts the next game when a bench has four players.',
      ])
    );
  }

  section.append(actions);
  return section;
}
