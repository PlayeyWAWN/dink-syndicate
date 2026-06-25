import { formatTeamLabel, matchLabel, winningTeamForMatch } from '@/lib/format-utils';
import { el } from '@/lib/dom-utils';
import {
  replaceCompletedMatchPlayerId,
  swapCompletedMatchPlayerIds,
  CompletedMatchUpdate,
} from '@/modules/queue/CompletedMatchService';
import {
  filterReplacementCandidates,
  validateEntryGenderRules,
} from '@/modules/queue/ManualMatchService';
import { renderMatchCourtBoard } from '@/ui/components/MatchCourtBoard';
import { openQueuePlayerEditDialog } from '@/ui/components/QueuePlayerEditDialog';
import { Match } from '@/types/queue';
import { Player } from '@/types/player';

export interface CompletedMatchEditDialogOptions {
  match: Match;
  players: Player[];
  /** Return false to keep the dialog open (e.g. validation failed). */
  onSave: (update: CompletedMatchUpdate) => boolean | void;
}

function mountDialog(className: string, content: HTMLElement): HTMLDialogElement {
  const dialog = el('dialog', { className: `queue-dialog ${className}` }) as HTMLDialogElement;
  dialog.append(content);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

function rosterReplacementPool(
  match: Match,
  player: Player,
  players: Player[]
): Player[] {
  return filterReplacementCandidates(
    match.format,
    player,
    players.filter((candidate) => !match.playerIds.includes(candidate.id))
  );
}

/** Edit winner, lineup, and optional note for a completed match. */
export function openCompletedMatchEditDialog(options: CompletedMatchEditDialogOptions): void {
  const { match, players, onSave } = options;

  let playerIds = [...match.playerIds];
  let winningTeam = winningTeamForMatch(match) ?? 'A';

  const panel = el('div', { className: 'queue-dialog__form completed-match-edit' });
  const title = el('h2', { className: 'queue-dialog__title' }, ['Edit completed match']);
  const summary = el('p', { className: 'queue-dialog__prompt completed-match-edit__summary' });
  const boardHost = el('div', { className: 'completed-match-edit__board' });
  const winnerRow = el('div', { className: 'completed-match-edit__winner-row' });
  const noteField = el('div', { className: 'completed-match-edit__note-field' });
  const noteInput = el('textarea', {
    className: 'completed-match-edit__note-input',
    rows: '3',
    maxlength: '500',
    placeholder: 'Optional note — e.g. Correct winner was Team 2',
    'aria-label': 'Correction note',
  }) as HTMLTextAreaElement;
  noteInput.value = match.correctionNote ?? '';

  const actions = el('div', { className: 'queue-dialog__actions' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancel']);
  const saveBtn = el('button', { type: 'button', className: 'btn' }, ['Save changes']);
  let dialog: HTMLDialogElement;

  const renderWinnerButtons = (): void => {
    const team1Btn = el('button', {
      type: 'button',
      className: `btn btn-sm completed-match-edit__winner-btn completed-match-edit__winner-btn--team1${
        winningTeam === 'A' ? ' completed-match-edit__winner-btn--active' : ''
      }`,
      'aria-pressed': winningTeam === 'A' ? 'true' : 'false',
    }, ['Team 1 wins']);

    const team2Btn = el('button', {
      type: 'button',
      className: `btn btn-sm completed-match-edit__winner-btn completed-match-edit__winner-btn--team2${
        winningTeam === 'B' ? ' completed-match-edit__winner-btn--active' : ''
      }`,
      'aria-pressed': winningTeam === 'B' ? 'true' : 'false',
    }, ['Team 2 wins']);

    team1Btn.addEventListener('click', () => {
      winningTeam = 'A';
      renderWinnerButtons();
      refreshSummary();
    });
    team2Btn.addEventListener('click', () => {
      winningTeam = 'B';
      renderWinnerButtons();
      refreshSummary();
    });

    winnerRow.replaceChildren(
      el('span', { className: 'completed-match-edit__winner-label' }, ['Winner']),
      team1Btn,
      team2Btn
    );
  };

  const refreshSummary = (): void => {
    summary.replaceChildren(
      el('strong', {}, [matchLabel({ ...match, playerIds }, players)]),
      ` · Winner: ${formatTeamLabel(playerIds, players, winningTeam)}`
    );
  };

  const refreshBoard = (): void => {
    boardHost.replaceChildren(
      renderMatchCourtBoard({
        playerIds,
        players,
        active: false,
        label: 'Completed match lineup',
        onPlayerChipClick: (playerId) => {
          const player = players.find((item) => item.id === playerId);
          if (!player) return;

          openQueuePlayerEditDialog({
            lineup: { format: match.format, playerIds },
            player,
            players,
            available: [],
            replacementPool: rosterReplacementPool({ ...match, playerIds }, player, players),
            replaceHint: 'Choose a roster player who should have played instead.',
            onSwap: (otherPlayerId) => {
              const nextIds = swapCompletedMatchPlayerIds(playerIds, playerId, otherPlayerId);
              if (!nextIds) return;
              if (!validateEntryGenderRules(match.format, nextIds, players)) {
                alert('Could not swap — gender rules for this match mode may block that lineup.');
                return;
              }
              playerIds = nextIds;
              refreshBoard();
              refreshSummary();
            },
            onReplace: (newPlayerId) => {
              const nextIds = replaceCompletedMatchPlayerId(playerIds, playerId, newPlayerId);
              if (!nextIds) return;
              if (!validateEntryGenderRules(match.format, nextIds, players)) {
                alert('Could not replace — gender rules for this match mode may block that lineup.');
                return;
              }
              playerIds = nextIds;
              refreshBoard();
              refreshSummary();
            },
          });
        },
      })
    );
  };

  noteField.append(
    el('label', { className: 'completed-match-edit__note-label' }, ['Correction note (optional)']),
    noteInput,
    el('p', { className: 'completed-match-edit__note-hint' }, [
      'Shown on Stats → All Matches exports when you download .txt, .csv, or Image.',
    ])
  );

  saveBtn.addEventListener('click', () => {
    const shouldClose =
      onSave({
        playerIds,
        winningTeam,
        correctionNote: noteInput.value.trim() || undefined,
      }) !== false;
    if (shouldClose) dialog.close();
  });
  cancelBtn.addEventListener('click', () => dialog.close());

  panel.append(
    title,
    el('p', { className: 'queue-dialog__prompt' }, [
      'Fix the winner, swap or replace players, and add a note if needed. Saving updates session stats, career stats, and match history together.',
    ]),
    summary,
    el('p', { className: 'completed-match-edit__hint' }, [
      'Tap a player on the court to swap with an opponent or replace with someone from the roster.',
    ]),
    boardHost,
    winnerRow,
    noteField,
    actions
  );
  actions.append(cancelBtn, saveBtn);

  renderWinnerButtons();
  refreshSummary();
  refreshBoard();

  dialog = mountDialog('queue-dialog--completed-edit', panel);
}
