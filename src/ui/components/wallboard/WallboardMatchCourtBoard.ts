import { el } from '@/lib/dom-utils';
import { splitTeams } from '@/lib/format-utils';
import { mountPickleballCourt } from '@/modules/courts/pickleball-court';
import { PublicPlayer } from '@/types/live';
import {
  findPublicPlayer,
  renderWallboardPlayerChip,
} from '@/ui/components/wallboard/wallboard-player-chip';

const POSITIONS = [
  { team: 'A' as const, index: 0, className: 'match-court-board__pos--tl' },
  { team: 'A' as const, index: 1, className: 'match-court-board__pos--bl' },
  { team: 'B' as const, index: 0, className: 'match-court-board__pos--tr' },
  { team: 'B' as const, index: 1, className: 'match-court-board__pos--br' },
];

export interface WallboardMatchCourtBoardOptions {
  playerIds: string[];
  players: PublicPlayer[];
  courtLabel: string;
}

/** Read-only court board for the live wallboard — Dink Syndicate SVG + Smash-style layout. */
export function renderWallboardMatchCourtBoard(
  options: WallboardMatchCourtBoardOptions
): HTMLElement {
  const { playerIds, players, courtLabel } = options;
  const { teamA, teamB } = splitTeams(playerIds);

  const board = el('div', { className: 'match-court-board' });
  const court = el('div', { className: 'match-court-board__court' });
  mountPickleballCourt(court, { active: true, label: courtLabel });

  for (const pos of POSITIONS) {
    const ids = pos.team === 'A' ? teamA : teamB;
    const playerId = ids[pos.index];
    const player = playerId ? findPublicPlayer(players, playerId) : undefined;
    if (!player && !playerId) continue;

    const wrap = el('div', { className: `match-court-board__pos ${pos.className}` });
    wrap.append(renderWallboardPlayerChip(player, pos.team, { compact: true }));
    court.append(wrap);
  }

  board.append(court);
  return board;
}
