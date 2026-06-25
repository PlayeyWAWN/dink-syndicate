import { el } from '@/lib/dom-utils';
import {
  ArrivalAnalyticsResult,
  ArrivalTier,
  formatArrivalPenaltyScore,
  formatSessionStartTime,
} from '@/modules/stats/ArrivalAnalyticsService';
import { AppIconId, mountAppIcon } from '@/ui/icons/app-icons';
import { Player } from '@/types/player';

const TIER_ORDER: ArrivalTier[] = [
  'early',
  'onTime',
  'grace',
  'late',
  'veryLate',
  'notCheckedIn',
];

const TIER_LABELS: Record<ArrivalTier, string> = {
  early: 'Early',
  onTime: 'On time',
  grace: 'Grace',
  late: 'Late',
  veryLate: 'Very late',
  notCheckedIn: 'Not checked in',
};

const TIER_ICON_IDS: Record<ArrivalTier, AppIconId> = {
  early: 'tier-early',
  onTime: 'tier-on-time',
  grace: 'tier-grace',
  late: 'tier-late',
  veryLate: 'tier-very-late',
  notCheckedIn: 'tier-not-checked-in',
};

function renderTierSummaryCard(tier: ArrivalTier, summary: ArrivalAnalyticsResult['summaries'][ArrivalTier]): HTMLElement {
  const card = el('article', {
    className: `arrival-analytics__tier-card arrival-analytics__tier-card--${tier}`,
  });
  card.append(
    el('strong', { className: 'arrival-analytics__tier-count' }, [String(summary.count)]),
    el('span', { className: 'arrival-analytics__tier-label' }, [TIER_LABELS[tier].toUpperCase()]),
    el('span', { className: 'arrival-analytics__tier-meta' }, [
      formatArrivalPenaltyScore(summary.avgPenaltyScore),
    ])
  );
  return card;
}

function renderPlayerChip(player: Player, tier: ArrivalTier): HTMLElement {
  return el('span', {
    className: `arrival-analytics__player-chip arrival-analytics__player-chip--${tier}`,
  }, [player.name]);
}

function renderTierGroup(
  tier: ArrivalTier,
  players: Player[]
): HTMLElement | null {
  if (players.length === 0) return null;

  const group = el('div', { className: 'arrival-analytics__tier-group' });
  const tierIcon = el('span', { className: 'arrival-analytics__tier-group-icon', 'aria-hidden': 'true' });
  mountAppIcon(tierIcon, TIER_ICON_IDS[tier]);
  group.append(
    el('div', { className: 'arrival-analytics__tier-group-head' }, [
      tierIcon,
      el('span', { className: 'arrival-analytics__tier-group-title' }, [
        `${TIER_LABELS[tier]} (${players.length})`,
      ]),
    ])
  );

  const chips = el('div', { className: 'arrival-analytics__player-chips' });
  for (const player of players) {
    chips.append(renderPlayerChip(player, tier));
  }
  group.append(chips);
  return group;
}

export function renderArrivalAnalyticsPanel(analytics: ArrivalAnalyticsResult): HTMLElement {
  const section = el('section', { className: 'card stats-section arrival-analytics' });

  const header = el('div', { className: 'arrival-analytics__header' });
  header.append(
    el('div', { className: 'arrival-analytics__header-main' }, [
      el('h3', { className: 'arrival-analytics__title' }, ['⏱ Arrival analytics']),
      el('p', { className: 'arrival-analytics__subtitle' }, ['Session check-in status']),
    ])
  );
  section.append(header);

  if (!analytics.configured) {
    section.append(
      el('p', { className: 'empty-state arrival-analytics__empty' }, [
        'Set a session start time in Settings to track who checked in early, on time, or late.',
      ])
    );
    return section;
  }

  const rosterCount = TIER_ORDER.reduce(
    (sum, tier) => sum + analytics.summaries[tier].count,
    0
  );
  if (rosterCount === 0) {
    section.append(
      el('p', { className: 'empty-state arrival-analytics__empty' }, [
        'No players on the roster yet.',
      ])
    );
    return section;
  }

  const summaryGrid = el('div', { className: 'arrival-analytics__summary-grid' });
  for (const tier of TIER_ORDER) {
    if (tier === 'notCheckedIn' && analytics.summaries[tier].count === 0) continue;
    summaryGrid.append(renderTierSummaryCard(tier, analytics.summaries[tier]));
  }
  section.append(summaryGrid);

  section.append(
    el('div', { className: 'arrival-analytics__session-start' }, [
      el('span', { className: 'arrival-analytics__session-start-label' }, ['Session start time']),
      el('strong', { className: 'arrival-analytics__session-start-value' }, [
        formatSessionStartTime(analytics.sessionStartTime!),
      ]),
    ])
  );

  section.append(
    el('p', { className: 'arrival-analytics__legend' }, [
      analytics.penaltyEnabled
        ? `Grace window: ${analytics.graceMinutes} min · Very late after ${analytics.veryLateThresholdMinutes} min · Numbers under each tier are avg Find Match penalty score (late min × ${analytics.lateMinutesWeight}).`
        : `Grace window: ${analytics.graceMinutes} min · Very late after ${analytics.veryLateThresholdMinutes} min · Find Match arrival penalty is off in Settings.`,
    ])
  );

  const hasCheckedIn = TIER_ORDER.some(
    (tier) => tier !== 'notCheckedIn' && analytics.playersByTier[tier].length > 0
  );
  if (hasCheckedIn) {
    const groups = el('div', { className: 'arrival-analytics__groups' });
    groups.append(el('h4', { className: 'arrival-analytics__groups-title' }, ['Players by arrival tier']));
    for (const tier of TIER_ORDER) {
      const group = renderTierGroup(tier, analytics.playersByTier[tier]);
      if (group) groups.append(group);
    }
    section.append(groups);
  }

  return section;
}
