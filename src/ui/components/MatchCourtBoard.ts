import { el } from '@/lib/dom-utils';
import { splitTeams } from '@/lib/format-utils';
import { mountPickleballCourt } from '@/modules/courts/pickleball-court';
import { renderMatchPlayerChip } from '@/ui/components/MatchPlayerChip';
import { SynergyDisplayOptions, getSynergyChipLabel } from '@/ui/components/SynergyTeamModal';
import { Player } from '@/types/player';

export interface MatchCourtBoardOptions {
  playerIds: string[];
  players: Player[];
  active?: boolean;
  label?: string;
  synergy?: SynergyDisplayOptions;
  onPlayerChipClick?: (playerId: string) => void;
  metaFormat?: 'games' | 'dupr';
}

const POSITIONS = [
  { team: 'A' as const, index: 0, className: 'match-court-board__pos--tl' },
  { team: 'A' as const, index: 1, className: 'match-court-board__pos--bl' },
  { team: 'B' as const, index: 0, className: 'match-court-board__pos--tr' },
  { team: 'B' as const, index: 1, className: 'match-court-board__pos--br' },
];

export function renderMatchCourtBoard(options: MatchCourtBoardOptions): HTMLElement {
  const { playerIds, players, active = false, label = 'Pickleball court', synergy, onPlayerChipClick, metaFormat } =
    options;
  const { teamA, teamB } = splitTeams(playerIds);

  const board = el('div', { className: 'match-court-board' });
  const court = el('div', { className: 'match-court-board__court' });
  mountPickleballCourt(court, { active, label });

  for (const pos of POSITIONS) {
    const ids = pos.team === 'A' ? teamA : teamB;
    const playerId = ids[pos.index];
    const player = playerId ? players.find((p) => p.id === playerId) : undefined;
    if (!player && !playerId) continue;

    const wrap = el('div', { className: `match-court-board__pos ${pos.className}` });
    wrap.append(
      renderMatchPlayerChip(player, {
        onClick:
          onPlayerChipClick && playerId
            ? () => onPlayerChipClick(playerId)
            : undefined,
        metaFormat,
        synergyPartnerName:
          playerId && synergy ? getSynergyChipLabel(playerId, synergy) : null,
      })
    );
    court.append(wrap);
  }

  board.append(court);
  return board;
}
