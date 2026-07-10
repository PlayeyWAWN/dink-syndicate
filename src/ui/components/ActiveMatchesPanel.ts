import { el } from '@/lib/dom-utils';
import { formatMatchDuration } from '@/lib/match-timer';
import { announceActiveMatch, isTtsSupported } from '@/lib/tts-service';
import { useSessionStore } from '@/stores/sessionStore';
import { renderMatchCourtBoard } from '@/ui/components/MatchCourtBoard';
import { openQueuePlayerEditDialog } from '@/ui/components/QueuePlayerEditDialog';
import { createAppIcon, mountAppIcon } from '@/ui/icons/app-icons';
import { SynergyDisplayOptions } from '@/ui/components/SynergyTeamModal';
import { Match } from '@/types/queue';
import { Court } from '@/types/court';
import { Player } from '@/types/player';

export interface ActiveMatchesPanelOptions {
  matches: Match[];
  courts: Court[];
  players: Player[];
  available: Player[];
  /** When set, used for REPLACE on matches that have stackMeta. */
  getStackReplacementPool?: (match: Match, player: Player) => Player[];
  synergy?: SynergyDisplayOptions;
  onComplete: (matchId: string, team: 'A' | 'B') => void;
  onCancel: (matchId: string) => void;
  onSwapPlayer: (matchId: string, playerIdA: string, playerIdB: string) => boolean;
  onReplacePlayer: (matchId: string, oldPlayerId: string, newPlayerId: string) => boolean;
}

function formatLabel(format: Match['format']): string {
  if (format === 'mixed_doubles') return 'Mixed doubles';
  if (format === 'same_gender_doubles') return 'Same gender';
  if (format === 'singles') return 'Singles';
  return 'Doubles';
}

export function renderActiveMatchesPanel(options: ActiveMatchesPanelOptions): HTMLElement {
  const {
    matches,
    courts,
    players,
    available,
    getStackReplacementPool,
    synergy,
    onComplete,
    onCancel,
    onSwapPlayer,
    onReplacePlayer,
  } = options;
  const section = el('section', { className: 'queue-section queue-section--active' });
  section.append(
    el('div', { className: 'queue-section__header' }, [
      el('h2', { className: 'queue-section__title' }, ['Active Matches']),
      el('span', { className: 'queue-section__count' }, [String(matches.length)]),
    ])
  );

  const body = el('div', { className: 'queue-section__body' });
  if (matches.length === 0) {
    body.append(
      el('p', { className: 'empty-state queue-section__empty' }, [
        'No matches in progress. Tap PLAY on a queued match below.',
      ])
    );
  } else {
    const list = el('div', { className: 'active-match-list' });
    for (const match of matches) {
      const court = courts.find((c) => c.id === match.courtId);
      const startedAt = match.startedAt ?? Date.now();
      const card = el('article', { className: 'active-match-card smash-active-match-card' });

      const header = el('div', { className: 'active-match-card__header-bar' });
      const headerMain = el('div', { className: 'active-match-card__header-main' });
      headerMain.append(
        el('div', { className: 'active-match-card__court-name' }, [court?.label ?? 'Court']),
        el('div', { className: 'active-match-card__header-meta' }, [
          el('span', { className: 'active-match-card__format' }, [formatLabel(match.format)]),
          el('span', {
            className: 'match-timer active-match-card__timer',
            'data-started-at': String(startedAt),
          }, [formatMatchDuration(Date.now() - startedAt)]),
        ])
      );

      const headerActions = el('div', { className: 'active-match-card__header-actions' });
      const announceBtn = el(
        'button',
        {
          type: 'button',
          className: 'btn btn-secondary btn-sm active-match-card__announce-btn',
          title: 'Announce match and player names (text to speech)',
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
          announceActiveMatch(match, court?.label, players, voiceUri);
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Could not start speech.');
        }
      });

      const cancelBtn = el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm active-match-card__cancel-btn',
        title:
          'Return this match to the queue without recording a result (games played and wins unchanged)',
        'aria-label': 'Return match to queue',
      });
      mountAppIcon(cancelBtn, 'delete');
      cancelBtn.addEventListener('click', () => {
        const confirmed = window.confirm(
          'Return this active match to the queue?\n\n' +
            '• The pairing goes back to queue position 1\n' +
            '• Games played and wins only change after you pick a winner\n' +
            '• Player wait timers are preserved'
        );
        if (!confirmed) return;
        onCancel(match.id);
      });

      headerActions.append(announceBtn, cancelBtn);
      header.append(headerMain, headerActions);

      card.append(
        header,
        renderMatchCourtBoard({
          playerIds: match.playerIds,
          players,
          active: true,
          label: court?.label ?? 'Active match',
          synergy,
          onPlayerChipClick: (playerId) => {
            const player = players.find((item) => item.id === playerId);
            if (!player) return;

            const stackPool =
              match.stackMeta && getStackReplacementPool
                ? getStackReplacementPool(match, player)
                : undefined;

            openQueuePlayerEditDialog({
              lineup: match,
              player,
              players,
              available,
              replacementPool: stackPool,
              replaceHint: stackPool
                ? 'Players waiting in stacks or not on court.'
                : undefined,
              onSwap: (otherPlayerId) => {
                if (!onSwapPlayer(match.id, playerId, otherPlayerId)) {
                  alert('Could not swap — gender rules for this match mode may block that lineup.');
                }
              },
              onReplace: (newPlayerId) => {
                if (!onReplacePlayer(match.id, playerId, newPlayerId)) {
                  alert('Could not replace — check gender rules and player availability.');
                }
              },
            });
          },
        })
      );

      const winRow = el('div', { className: 'active-match-card__win-row' });
      const win1 = el('button', {
        type: 'button',
        className: 'btn btn-sm active-match-card__win-btn active-match-card__win-btn--team1',
      }, ['Team 1 Wins']);
      const win2 = el('button', {
        type: 'button',
        className: 'btn btn-sm active-match-card__win-btn active-match-card__win-btn--team2',
      }, ['Team 2 Wins']);
      win1.addEventListener('click', () => onComplete(match.id, 'A'));
      win2.addEventListener('click', () => onComplete(match.id, 'B'));
      winRow.append(win1, win2);
      card.append(winRow);

      list.append(card);
    }
    body.append(list);
  }

  section.append(body);
  return section;
}
