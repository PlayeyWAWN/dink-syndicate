import { el } from '@/lib/dom-utils';
import { splitTeams, teamAvgGames } from '@/lib/format-utils';
import { formatQueueWaitDuration } from '@/lib/match-timer';
import { announceQueueEntry, isTtsSupported } from '@/lib/tts-service';
import { useSessionStore } from '@/stores/sessionStore';
import { renderMatchPlayerChip } from '@/ui/components/MatchPlayerChip';
import { createAppIcon, mountAppIcon } from '@/ui/icons/app-icons';
import { QueueEntry } from '@/types/queue';
import { Player } from '@/types/player';

export interface QueueListOptions {
  entries: QueueEntry[];
  players: Player[];
  hasOpenCourt: boolean;
  onRemove: (entryId: string) => void;
  onPlay: (entryId: string) => void;
  /** Fired when Play is tapped but every court is occupied. */
  onNoOpenCourts?: () => void;
  onPlayerChipClick?: (entryId: string, playerId: string) => void;
}

function formatEntryType(format: QueueEntry['format']): string {
  if (format === 'mixed_doubles') return 'Mixed (1M+1F)';
  if (format === 'same_gender_doubles') return 'Same Gender';
  if (format === 'singles') return 'Singles';
  return 'Doubles';
}

function renderTeamSide(
  entryId: string,
  team: 'A' | 'B',
  playerIds: string[],
  players: Player[],
  onPlayerChipClick?: (entryId: string, playerId: string) => void
): HTMLElement {
  const { teamA, teamB } = splitTeams(playerIds);
  const ids = team === 'A' ? teamA : teamB;
  const side = el('div', { className: 'match-queue-card__team-side' });
  side.append(
    el('div', {
      className: `match-queue-card__team-label match-queue-card__team-label--${team === 'A' ? 'team1' : 'team2'}`,
    }, [team === 'A' ? 'Team 1' : 'Team 2']),
    el('div', { className: 'match-queue-card__team-avg' }, [
      `Avg. ${teamAvgGames(playerIds, players, team).toFixed(1)} games`,
    ])
  );

  const playersRow = el('div', { className: 'match-queue-card__team-players' });
  for (const id of ids) {
    const player = players.find((p) => p.id === id);
    playersRow.append(
      renderMatchPlayerChip(player, {
        onClick: onPlayerChipClick ? () => onPlayerChipClick(entryId, id) : undefined,
      })
    );
  }
  side.append(playersRow);
  return side;
}

export function renderQueueList(options: QueueListOptions): HTMLElement {
  const { entries, players, hasOpenCourt, onRemove, onPlay, onNoOpenCourts, onPlayerChipClick } =
    options;
  const list = el('div', { className: 'queue-list match-queue-list' });

  if (entries.length === 0) {
    list.append(
      el('p', { className: 'empty-state' }, [
        'No matches waiting. Tap Create Match or select players below to queue manually.',
      ])
    );
    return list;
  }

  entries.forEach((entry, index) => {
    const card = el('article', { className: 'match-queue-card' });
    const queuedAt = entry.createdAt;
    const waitNow = formatQueueWaitDuration(Date.now() - queuedAt);

    const header = el('div', { className: 'match-queue-card__header' });
    const headerLeft = el('div', { className: 'match-queue-card__header-left' });
    headerLeft.append(
      el('span', { className: 'match-queue-card__number' }, [String(index + 1)]),
      el('span', { className: 'match-queue-card__title' }, [`Queue ${index + 1}`])
    );
    if (entry.source === 'manual') {
      headerLeft.append(
        el('span', {
          className: 'match-queue-card__source-badge match-queue-card__source-badge--manual',
          title: 'Built manually from available players',
        }, ['MANUAL'])
      );
    }
    const waitWrap = el('span', { className: 'match-queue-card__wait' }, ['→ ']);
    waitWrap.append(
      el('span', {
        className: 'match-queue-card__wait-live match-timer',
        'data-queued-at': String(queuedAt),
      }, [waitNow])
    );
    headerLeft.append(waitWrap);

    const headerActions = el('div', { className: 'match-queue-card__header-actions' });
    const playBtn = el(
      'button',
      {
        type: 'button',
        className: `btn btn-success btn-sm match-queue-card__play-btn${
          hasOpenCourt ? '' : ' match-queue-card__play-btn--no-court'
        }`,
        title: hasOpenCourt
          ? 'Start match on next open court'
          : 'All courts occupied — tap for details',
        'aria-disabled': hasOpenCourt ? 'false' : 'true',
      },
      []
    );
    playBtn.append(createAppIcon('play'), document.createTextNode(' PLAY'));
    playBtn.addEventListener('click', () => {
      if (!hasOpenCourt) {
        onNoOpenCourts?.();
        return;
      }
      onPlay(entry.id);
    });

    const announceBtn = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-secondary btn-sm match-queue-card__announce-btn',
        title: 'Announce team names (text to speech)',
      },
      []
    );
    announceBtn.append(createAppIcon('announce'), document.createTextNode(' Announce'));
    announceBtn.addEventListener('click', () => {
      if (!isTtsSupported()) {
        alert('Text to speech is not available in this browser.');
        return;
      }
      try {
        const voiceUri = useSessionStore.getState().loadSnapshot()?.settings?.ttsVoiceUri;
        announceQueueEntry(entry, index + 1, players, voiceUri);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Could not start speech.');
      }
    });

    const removeBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm match-queue-card__remove-btn',
      title: 'Remove from queue',
      'aria-label': 'Remove from queue',
    });
    mountAppIcon(removeBtn, 'delete');
    removeBtn.addEventListener('click', () => onRemove(entry.id));

    headerActions.append(announceBtn, playBtn, removeBtn);
    header.append(headerLeft, headerActions);

    if (entry.source === 'manual') {
      card.classList.add('match-queue-card--manual');
    }

    const fairness = el('div', { className: 'match-queue-card__fairness' });
    fairness.append(
      el('strong', {}, ['Queue priority: ']),
      document.createTextNode('Fewest games first, then skill balance. '),
      el('small', {}, [
        `Team 1: ${teamAvgGames(entry.playerIds, players, 'A').toFixed(1)}g avg · Team 2: ${teamAvgGames(entry.playerIds, players, 'B').toFixed(1)}g avg · ${formatEntryType(entry.format)} · Tap a name to swap or replace`,
      ])
    );

    const vsLayout = el('div', { className: 'match-queue-card__vs-layout' });
    vsLayout.append(
      renderTeamSide(entry.id, 'A', entry.playerIds, players, onPlayerChipClick),
      el('div', { className: 'match-queue-card__vs' }, ['VS']),
      renderTeamSide(entry.id, 'B', entry.playerIds, players, onPlayerChipClick)
    );

    card.append(header, fairness, vsLayout);
    list.append(card);
  });

  return list;
}
