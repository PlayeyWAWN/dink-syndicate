import { el } from '@/lib/dom-utils';
import { createMatchErrorMessage, allCourtsOccupiedMessage, COURT_FORMATS, QUEUE_MATCH_MODES } from '@/config/queue-match-modes';
import { pickleballIconHtml } from '@/ui/icons/pickleball-icon';
import { useQueueUiStore } from '@/stores/queueUiStore';
import { useQueueStore } from '@/stores/queueStore';
import { useCourtStore } from '@/stores/courtStore';
import { appRouter } from '@/app/router';
import { renderQueueList } from '@/ui/components/QueueList';
import { openQueuePlayerEditDialog } from '@/ui/components/QueuePlayerEditDialog';
import { SynergyDisplayOptions } from '@/ui/components/SynergyTeamModal';
import type { CourtFormat, QueueMatchMode } from '@/config/queue-match-modes';
import { Player } from '@/types/player';

export interface MatchQueueSectionOptions {
  courtFormat: CourtFormat;
  matchMode: QueueMatchMode;
  openCourtCount: number;
  players: Player[];
  synergy?: SynergyDisplayOptions;
  onNavigate?: () => void;
}

/**
 * Match queue section: court format/mode toggles, queue list, create-match button.
 */
export function renderMatchQueueSection(options: MatchQueueSectionOptions): {
  section: HTMLElement;
  createMatchBtn: HTMLButtonElement;
} {
  const {
    courtFormat,
    matchMode,
    openCourtCount,
    players,
    synergy,
    onNavigate = () => appRouter.navigate('queue'),
  } = options;

  const isDoublesFormat = courtFormat === 'doubles';
  const {
    queueState,
    createMatch,
    removeFromQueue,
    playQueueEntry,
    getAvailablePlayers,
    swapQueuePlayers,
    replaceQueuePlayer,
  } = useQueueStore.getState();

  const matchQueueSection = el('section', { className: 'queue-section queue-section--waiting' });

  const formatRow = el('div', { className: 'queue-mode-row' });
  formatRow.append(el('span', { className: 'queue-mode-row__label' }, ['Court format']));
  const formatGroup = el('div', {
    className: 'queue-mode-group',
    role: 'radiogroup',
    'aria-label': 'Court format',
  });

  for (const format of COURT_FORMATS) {
    const isActive = courtFormat === format.id;
    const btn = el('button', {
      type: 'button',
      className: `queue-mode-toggle${isActive ? ' queue-mode-toggle--active' : ''}`,
      'aria-pressed': isActive ? 'true' : 'false',
    }, [format.label]);
    btn.addEventListener('click', () => {
      useQueueUiStore.getState().setCourtFormat(format.id);
      onNavigate();
    });
    formatGroup.append(btn);
  }

  formatRow.append(formatGroup);
  matchQueueSection.append(formatRow);

  const modeRow = el('div', {
    className: `queue-mode-row${isDoublesFormat ? '' : ' queue-mode-row--disabled'}`,
  });
  modeRow.append(el('span', { className: 'queue-mode-row__label' }, ['Match mode']));
  const modeGroup = el('div', {
    className: 'queue-mode-group',
    role: 'radiogroup',
    'aria-label': 'Match mode',
  });

  for (const mode of QUEUE_MATCH_MODES) {
    const isActive = matchMode === mode.id;
    const btn = el('button', {
      type: 'button',
      className: `queue-mode-toggle${isActive ? ' queue-mode-toggle--active' : ''}`,
      'aria-pressed': isActive ? 'true' : 'false',
      'aria-label': mode.label,
      disabled: isDoublesFormat ? undefined : 'true',
    }, [mode.shortLabel]);
    btn.addEventListener('click', () => {
      if (!isDoublesFormat) return;
      useQueueUiStore.getState().setMatchMode(mode.id);
      onNavigate();
    });
    modeGroup.append(btn);
  }

  modeRow.append(modeGroup);
  if (!isDoublesFormat) {
    modeRow.append(
      el('p', { className: 'queue-mode-row__hint' }, [
        'Match mode applies to doubles only. Singles always uses balanced skill matching.',
      ])
    );
  }
  matchQueueSection.append(modeRow);

  const createMatchBtn = el('button', {
    type: 'button',
    className: 'btn btn-success btn-create-match',
  }) as HTMLButtonElement;
  createMatchBtn.innerHTML = `${pickleballIconHtml()}<span>Create Match</span>`;
  createMatchBtn.addEventListener('click', () => {
    const { courtFormat: format, matchMode: mode } = useQueueUiStore.getState();
    const availablePlayers = useQueueStore.getState().getAvailablePlayers();
    const males = availablePlayers.filter((player) => player.gender === 'male').length;
    const females = availablePlayers.filter((player) => player.gender === 'female').length;
    if (!createMatch(format, mode)) {
      alert(
        createMatchErrorMessage(format, mode, {
          available: availablePlayers.length,
          males,
          females,
        })
      );
    } else {
      onNavigate();
    }
  });

  const listCard = el('div', { className: 'queue-section__body' });
  const notifyAllCourtsOccupied = () => {
    const courts = useCourtStore.getState().courts;
    const activeMatchCount = courts.filter((court) => court.activeMatchId).length;
    alert(allCourtsOccupiedMessage(courts.length, activeMatchCount));
  };

  listCard.append(
    renderQueueList({
      entries: queueState.queue,
      players,
      hasOpenCourt: openCourtCount > 0,
      synergy,
      onNoOpenCourts: notifyAllCourtsOccupied,
      onRemove: (id) => {
        removeFromQueue(id);
        onNavigate();
      },
      onPlay: (id) => {
        if (openCourtCount <= 0) {
          notifyAllCourtsOccupied();
          return;
        }
        if (!playQueueEntry(id)) {
          notifyAllCourtsOccupied();
          return;
        }
        onNavigate();
      },
      onPlayerChipClick: (entryId, playerId) => {
        const entry = queueState.queue.find((item) => item.id === entryId);
        const player = players.find((item) => item.id === playerId);
        if (!entry || !player) return;

        openQueuePlayerEditDialog({
          lineup: entry,
          player,
          players,
          available: getAvailablePlayers(),
          onSwap: (otherPlayerId) => {
            if (!swapQueuePlayers(entryId, playerId, otherPlayerId)) {
              alert(
                'Could not swap — check gender rules, Synergy Team locks, or player availability.'
              );
              return;
            }
            onNavigate();
          },
          onReplace: (newPlayerId) => {
            if (!replaceQueuePlayer(entryId, playerId, newPlayerId)) {
              alert(
                'Could not replace — check gender rules, Synergy Team locks, or player availability.'
              );
              return;
            }
            onNavigate();
          },
        });
      },
    })
  );
  matchQueueSection.append(listCard);

  return { section: matchQueueSection, createMatchBtn };
}
