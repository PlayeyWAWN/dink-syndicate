import { el } from '@/lib/dom-utils';
import { formatDuprRating } from '@/lib/format-utils';
import { formatSkillLevel, getSkillLevelFromDupr, skillLevelBadgeClass } from '@/lib/skill-utils';
import {
  createAppIconLabel,
  genderAppIconId,
  mountAppIcon,
} from '@/ui/icons/app-icons';
import {
  playerActionIconHtml,
  type PlayerActionIconId,
} from '@/ui/icons/player-action-icons';
import { Player } from '@/types/player';

export interface PlayerCardOptions {
  onEdit: (playerId: string) => void;
  onToggleCheckIn: (playerId: string) => void;
  onExclude: (playerId: string) => void;
  onRemove: (playerId: string) => void;
}

function iconButton(
  label: string,
  iconId: PlayerActionIconId,
  modifier: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = el('button', {
    type: 'button',
    className: `btn btn-secondary btn-small player-action-btn player-action-btn--${modifier}`,
    title: label,
    'aria-label': label,
  }) as HTMLButtonElement;
  btn.innerHTML = playerActionIconHtml(iconId);
  btn.addEventListener('click', onClick);
  return btn;
}

export function renderPlayerCard(player: Player, options: PlayerCardOptions): HTMLElement {
  const rating = player.dupr.duprDoublesRating ?? 0;
  const skill = getSkillLevelFromDupr(rating);
  const genderLabel = player.gender === 'female' ? 'Female' : 'Male';

  const cardClasses = [
    'card',
    'player-roster-card',
    player.excluded ? 'player-roster-card--excluded' : '',
    !player.checkedIn ? 'player-roster-card--out' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const card = el('article', { className: cardClasses });
  const row = el('div', { className: 'list-item' });

  const avatar = el('div', {
    className: `avatar avatar--roster ${player.gender}`,
  });
  mountAppIcon(avatar, genderAppIconId(player.gender));

  const content = el('div', { className: 'list-content' });
  content.append(el('div', { className: 'list-title' }, [player.name]));

  const subtitle = el('div', { className: 'list-subtitle' });
  subtitle.append(
    el('span', {}, [genderLabel]),
    el('span', { className: 'list-subtitle__dot' }, [' • ']),
    el('span', { className: skillLevelBadgeClass(skill) }, [formatSkillLevel(skill)]),
    el('span', { className: 'list-subtitle__dot' }, [' • ']),
    el('span', { className: 'list-subtitle__dupr' }, [`DUPR ${formatDuprRating(rating)}`])
  );
  content.append(subtitle);

  content.append(
    el('div', { className: 'list-meta' }, [
      `${player.gamesPlayed} games · ${player.wins} wins`,
    ])
  );

  if (player.excluded) {
    content.append(
      el('div', { className: 'player-status-badge player-status-badge--excluded' }, [
        createAppIconLabel('excluded', 'Excluded from matches'),
      ])
    );
  } else if (!player.checkedIn) {
    content.append(
      el('div', { className: 'player-status-badge player-status-badge--out' }, [
        createAppIconLabel('not-checked-in', 'Not checked in — unavailable for Find Match'),
      ])
    );
  }

  const actions = el('div', { className: 'player-actions' });
  actions.append(
    iconButton('Edit player', 'edit', 'edit', () => options.onEdit(player.id)),
    iconButton(
      player.checkedIn ? 'Check out' : 'Check in',
      player.checkedIn ? 'checkout' : 'checkin',
      'checkout',
      () => options.onToggleCheckIn(player.id)
    ),
    iconButton(
      player.excluded ? 'Include player' : 'Exclude player',
      player.excluded ? 'include' : 'exclude',
      'exclude',
      () => options.onExclude(player.id)
    ),
    iconButton('Delete player', 'delete', 'delete', () => {
      if (window.confirm(`Remove ${player.name} from the roster?`)) {
        options.onRemove(player.id);
      }
    })
  );

  row.append(avatar, content, actions);
  card.append(row);
  return card;
}
