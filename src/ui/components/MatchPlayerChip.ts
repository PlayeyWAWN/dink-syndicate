import { el } from '@/lib/dom-utils';
import { formatSkillLevel, getSkillLevelFromDupr } from '@/lib/skill-utils';
import { genderAppIconId, mountAppIcon } from '@/ui/icons/app-icons';
import { Player } from '@/types/player';

export interface MatchPlayerChipOptions {
  onClick?: () => void;
}

export function renderMatchPlayerChip(
  player: Player | undefined,
  options: MatchPlayerChipOptions = {}
): HTMLElement {
  if (!player) {
    return el('div', { className: 'match-player-chip match-player-chip--empty' }, ['—']);
  }

  const skill = formatSkillLevel(getSkillLevelFromDupr(player.dupr.duprDoublesRating));
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
    el('div', { className: 'match-player-chip__meta' }, [`${player.gamesPlayed}g · ${skill}`]),
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
