import { el } from '@/lib/dom-utils';
import { formatSkillLevel, getSkillLevelFromDupr } from '@/lib/skill-utils';
import { PublicPlayer } from '@/types/live';
import { genderAppIconId, mountAppIcon } from '@/ui/icons/app-icons';

export function findPublicPlayer(
  players: PublicPlayer[],
  playerId: string
): PublicPlayer | undefined {
  return players.find((p) => p.id === playerId);
}

export function renderWallboardPlayerChip(
  player: PublicPlayer | undefined,
  team: 'A' | 'B',
  options?: { compact?: boolean; courtLayout?: boolean }
): HTMLElement {
  if (!player) {
    return el('div', { className: 'match-player-chip match-player-chip--empty' }, ['—']);
  }

  const rating =
    player.duprDoublesRating != null ? player.duprDoublesRating.toFixed(1) : '—';
  const skill = formatSkillLevel(getSkillLevelFromDupr(player.duprDoublesRating));
  const meta = options?.compact
    ? `${rating} · ${skill}`
    : `${player.gamesPlayed}g · ${rating} · ${skill}`;

  const chipClasses = [
    'match-player-chip',
    'live-wallboard__player-chip',
    `live-wallboard__player-chip--team-${team.toLowerCase()}`,
    options?.courtLayout ? 'live-wallboard__player-chip--court' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const chip = el('div', { className: chipClasses });

  if (options?.courtLayout) {
    const gender = player.gender ?? 'male';
    const iconWrap = el('div', { className: 'match-player-chip__icon-wrap' });
    const icon = el('div', { className: 'match-player-chip__icon', 'aria-hidden': 'true' });
    mountAppIcon(icon, genderAppIconId(gender));
    iconWrap.append(icon);

    const stack = el('div', { className: 'live-wallboard__player-chip-stack' });
    stack.append(
      iconWrap,
      el('div', {
        className: 'match-player-chip__name',
        title: player.name,
      }, [player.name]),
      el('div', { className: 'match-player-chip__meta match-player-chip__meta--rating' }, [rating])
    );
    chip.append(stack);
    return chip;
  }

  chip.append(
    el('div', {
      className: 'match-player-chip__name',
      title: player.name,
    }, [player.name]),
    el('div', { className: 'match-player-chip__meta' }, [meta])
  );
  return chip;
}
