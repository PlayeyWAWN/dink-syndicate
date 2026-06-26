import { el } from '@/lib/dom-utils';
import { formatSkillLevel, getSkillLevelFromDupr } from '@/lib/skill-utils';
import { PublicPlayer } from '@/types/live';

export function findPublicPlayer(
  players: PublicPlayer[],
  playerId: string
): PublicPlayer | undefined {
  return players.find((p) => p.id === playerId);
}

export function renderWallboardPlayerChip(
  player: PublicPlayer | undefined,
  team: 'A' | 'B',
  options?: { compact?: boolean }
): HTMLElement {
  if (!player) {
    return el('div', { className: 'match-player-chip match-player-chip--empty' }, ['—']);
  }

  const skill = formatSkillLevel(getSkillLevelFromDupr(player.duprDoublesRating));
  const rating =
    player.duprDoublesRating != null ? player.duprDoublesRating.toFixed(1) : '—';
  const meta = options?.compact
    ? `${rating} · ${skill}`
    : `${player.gamesPlayed}g · ${rating} · ${skill}`;

  const chip = el('div', {
    className: `match-player-chip live-wallboard__player-chip live-wallboard__player-chip--team-${team.toLowerCase()}`,
  });
  chip.append(
    el('div', { className: 'match-player-chip__name' }, [player.name]),
    el('div', { className: 'match-player-chip__meta' }, [meta])
  );
  return chip;
}
