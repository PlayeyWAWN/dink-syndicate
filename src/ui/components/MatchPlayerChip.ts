import { el } from '@/lib/dom-utils';
import { formatSkillLevel, getSkillLevelFromDupr } from '@/lib/skill-utils';
import { genderAppIconId, mountAppIcon } from '@/ui/icons/app-icons';
import { Player } from '@/types/player';

export interface MatchPlayerChipOptions {
  onClick?: () => void;
  /** When 'dupr', show rating and skill instead of games played. */
  metaFormat?: 'games' | 'dupr';
}

function formatChipMeta(player: Player, metaFormat: 'games' | 'dupr'): string {
  const skill = formatSkillLevel(getSkillLevelFromDupr(player.dupr.duprDoublesRating));
  if (metaFormat === 'dupr') {
    const rating = player.dupr.duprDoublesRating;
    const ratingLabel = rating != null ? rating.toFixed(1) : '—';
    return `${ratingLabel} · ${skill}`;
  }
  return `${player.gamesPlayed}g · ${skill}`;
}

export function renderMatchPlayerChip(
  player: Player | undefined,
  options: MatchPlayerChipOptions = {}
): HTMLElement {
  if (!player) {
    return el('div', { className: 'match-player-chip match-player-chip--empty' }, ['—']);
  }

  const metaFormat = options.metaFormat ?? 'games';
  const className = [
    'match-player-chip',
    `match-player-chip--${player.gender}`,
    options.onClick ? 'match-player-chip--interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconWrap = el('div', { className: 'match-player-chip__icon', 'aria-hidden': 'true' });
  mountAppIcon(iconWrap, genderAppIconId(player.gender));

  const content = [
    iconWrap,
    el('div', { className: 'match-player-chip__name' }, [player.name]),
    el('div', { className: 'match-player-chip__meta' }, [formatChipMeta(player, metaFormat)]),
  ];

  if (options.onClick) {
    const chip = el('button', {
      type: 'button',
      className,
      title: `Edit ${player.name}`,
    }) as HTMLButtonElement;
    chip.append(...content);
    chip.addEventListener('click', options.onClick);
    return chip;
  }

  const chip = el('div', { className });
  chip.append(...content);
  return chip;
}
