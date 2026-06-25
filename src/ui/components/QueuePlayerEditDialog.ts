import { el } from '@/lib/dom-utils';
import { formatDuprRating } from '@/lib/format-utils';
import { filterPlayersBySearch } from '@/lib/queue-player-search';
import { clearLiveTimers, formatMatchDuration, mountLiveTimers } from '@/lib/match-timer';
import { formatSkillLevel, getSkillLevelFromDupr } from '@/lib/skill-utils';
import {
  filterReplacementCandidates,
  opponentPlayerIds,
  partnerPlayerId,
  sortAvailableByLongestWait,
} from '@/modules/queue/ManualMatchService';
import { Player } from '@/types/player';
import { QueueEntry } from '@/types/queue';
import { renderQueuePlayerSearch } from '@/ui/components/QueuePlayerSearch';

export interface LineupEditContext {
  format: QueueEntry['format'];
  playerIds: string[];
}

export interface QueuePlayerEditDialogOptions {
  lineup: LineupEditContext;
  player: Player;
  players: Player[];
  available: Player[];
  /** When set, used instead of filtering `available` for replace candidates. */
  replacementPool?: Player[];
  replaceHint?: string;
  onSwap: (otherPlayerId: string) => void;
  onReplace: (newPlayerId: string) => void;
}

interface SwapContext {
  partner: Player | null;
  opponents: Player[];
}

function mountDialog(className: string, content: HTMLElement): HTMLDialogElement {
  const dialog = el('dialog', { className: `queue-dialog ${className}` }) as HTMLDialogElement;
  dialog.append(content);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

function swapContextFor(lineup: LineupEditContext, player: Player, players: Player[]): SwapContext {
  const partnerId = partnerPlayerId(lineup.playerIds, player.id);
  const partner = partnerId ? players.find((item) => item.id === partnerId) ?? null : null;
  const opponents = opponentPlayerIds(lineup.playerIds, player.id)
    .map((id) => players.find((item) => item.id === id))
    .filter(Boolean) as Player[];

  return { partner, opponents };
}

function renderPartnerRow(partner: Player): HTMLElement {
  return el('div', {
    className: `queue-dialog__player-row queue-dialog__player-row--partner queue-dialog__player-row--${partner.gender}`,
    'aria-disabled': 'true',
  }, [
    el('span', { className: 'queue-dialog__player-row-label' }, ['Current partner']),
    el('strong', { className: 'queue-dialog__player-row-name' }, [partner.name]),
    el('span', { className: 'queue-dialog__player-row-meta' }, [
      `${partner.gamesPlayed}g · DUPR ${formatDuprRating(partner.dupr.duprDoublesRating)}`,
    ]),
  ]);
}

function openPlayerActionDialog(options: QueuePlayerEditDialogOptions): void {
  const { player, lineup, players, available, replacementPool } = options;
  const replaceCandidates = replacementPool ?? filterReplacementCandidates(lineup.format, player, available);
  const swapContext = swapContextFor(lineup, player, players);
  const canReplace = replaceCandidates.length > 0;
  const canSwap = swapContext.opponents.length > 0;

  const panel = el('div', { className: 'queue-dialog__form' });
  panel.append(
    el('h2', { className: 'queue-dialog__title' }, ['Player Actions']),
    el('p', { className: 'queue-dialog__prompt' }, [
      'What would you like to do with ',
      el('strong', {}, [player.name]),
      '?',
    ])
  );

  const choices = el('div', { className: 'queue-dialog__action-choices' });
  let dialog: HTMLDialogElement;

  const replaceBtn = el('button', {
    type: 'button',
    className: 'queue-dialog__action-choice queue-dialog__action-choice--replace',
    disabled: canReplace ? undefined : 'true',
    title: canReplace ? undefined : 'No available players to substitute',
  }, [
    el('span', { className: 'queue-dialog__action-choice-icon', 'aria-hidden': 'true' }, ['↻']),
    el('span', { className: 'queue-dialog__action-choice-body' }, [
      el('strong', { className: 'queue-dialog__action-choice-label' }, ['Replace']),
      el('span', { className: 'queue-dialog__action-choice-hint' }, [
        'Replace with a standby player',
      ]),
    ]),
  ]);
  replaceBtn.addEventListener('click', () => {
    dialog.close();
    openPlayerReplaceDialog(options, () => openPlayerActionDialog(options));
  });

  const swapBtn = el('button', {
    type: 'button',
    className: 'queue-dialog__action-choice queue-dialog__action-choice--swap',
    disabled: canSwap ? undefined : 'true',
    title: canSwap ? undefined : 'No opponents in this match to swap with',
  }, [
    el('span', { className: 'queue-dialog__action-choice-icon', 'aria-hidden': 'true' }, ['⇄']),
    el('span', { className: 'queue-dialog__action-choice-body' }, [
      el('strong', { className: 'queue-dialog__action-choice-label' }, ['Swap']),
      el('span', { className: 'queue-dialog__action-choice-hint' }, [
        'Swap with an opponent',
      ]),
    ]),
  ]);
  swapBtn.addEventListener('click', () => {
    dialog.close();
    openPlayerSwapDialog(options, swapContext, () => openPlayerActionDialog(options));
  });

  choices.append(replaceBtn, swapBtn);
  panel.append(choices);

  const actions = el('div', { className: 'queue-dialog__actions queue-dialog__actions--stack' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block' }, [
    'Cancel',
  ]);
  cancelBtn.addEventListener('click', () => dialog.close());
  actions.append(cancelBtn);
  panel.append(actions);

  dialog = mountDialog('queue-dialog--actions', panel);
}

function openPlayerSwapDialog(
  options: QueuePlayerEditDialogOptions,
  swapContext: SwapContext,
  onBack: () => void
): void {
  const { player, onSwap } = options;
  const { partner, opponents } = swapContext;
  const panel = el('div', { className: 'queue-dialog__form' });
  panel.append(
    el('h2', { className: 'queue-dialog__title' }, ['Swap player']),
    el('p', { className: 'queue-dialog__prompt' }, [
      'Choose an opponent for ',
      el('strong', {}, [player.name]),
      ' to swap with.',
    ])
  );

  const list = el('div', { className: 'queue-dialog__player-list' });
  let dialog: HTMLDialogElement;

  if (partner) {
    list.append(renderPartnerRow(partner));
  }

  if (opponents.length === 0) {
    list.append(el('p', { className: 'queue-dialog__empty' }, ['No opponents available to swap with.']));
  } else {
    for (const opponent of opponents) {
      const btn = el('button', {
        type: 'button',
        className: `queue-dialog__player-btn queue-dialog__player-btn--${opponent.gender}`,
      }, [
        el('span', { className: 'queue-dialog__player-btn-label' }, ['Opponent']),
        el('strong', {}, [opponent.name]),
        el('span', { className: 'queue-dialog__player-btn-meta' }, [
          `${opponent.gamesPlayed}g · DUPR ${formatDuprRating(opponent.dupr.duprDoublesRating)}`,
        ]),
      ]);
      btn.addEventListener('click', () => {
        onSwap(opponent.id);
        dialog.close();
      });
      list.append(btn);
    }
  }
  panel.append(list);

  const actions = el('div', { className: 'queue-dialog__actions' });
  const backBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Back']);
  backBtn.addEventListener('click', () => {
    dialog.close();
    onBack();
  });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancel']);
  cancelBtn.addEventListener('click', () => dialog.close());
  actions.append(backBtn, cancelBtn);
  panel.append(actions);

  dialog = mountDialog('queue-dialog--swap', panel);
}

function renderReplaceCandidateButton(
  candidate: Player,
  onSelect: () => void
): HTMLButtonElement {
  const availableSince = candidate.availableSince ?? Date.now();
  const btn = el('button', {
    type: 'button',
    className: `queue-dialog__player-btn queue-dialog__player-btn--replace queue-dialog__player-btn--${candidate.gender}`,
  }, [
    el('span', { className: 'queue-dialog__player-btn-main' }, [
      el('strong', { className: 'queue-dialog__player-btn-name' }, [candidate.name]),
      el('span', { className: 'queue-dialog__player-btn-meta' }, [
        `${candidate.gamesPlayed}g · DUPR ${formatDuprRating(candidate.dupr.duprDoublesRating)} · ${formatSkillLevel(getSkillLevelFromDupr(candidate.dupr.duprDoublesRating))}`,
      ]),
    ]),
    el('span', {
      className: 'queue-dialog__player-btn-wait match-timer',
      'data-available-since': String(availableSince),
      title: 'Time waiting on standby',
    }, [formatMatchDuration(Date.now() - availableSince)]),
  ]) as HTMLButtonElement;

  btn.addEventListener('click', onSelect);
  return btn;
}

function openPlayerReplaceDialog(
  options: QueuePlayerEditDialogOptions,
  onBack: () => void
): void {
  const { lineup, player, available, replacementPool, replaceHint, onReplace } = options;
  const replaceCandidates = sortAvailableByLongestWait(
    replacementPool ?? filterReplacementCandidates(lineup.format, player, available)
  );

  const panel = el('div', { className: 'queue-dialog__form' });
  const prompt = el('p', { className: 'queue-dialog__prompt' });
  if (replaceHint) {
    prompt.textContent = replaceHint;
  } else {
    prompt.append(
      'Choose a standby player to replace ',
      el('strong', {}, [player.name]),
      '. Longest wait at top.'
    );
  }

  panel.append(
    el('h2', { className: 'queue-dialog__title' }, ['Replace player']),
    prompt
  );

  let searchQuery = '';
  const list = el('div', {
    className: 'queue-dialog__player-list queue-dialog__player-list--scroll queue-dialog__player-list--tall',
  });
  let dialog: HTMLDialogElement;

  const renderReplaceList = (): void => {
    list.replaceChildren();

    if (replaceCandidates.length === 0) {
      list.append(
        el('p', { className: 'queue-dialog__empty' }, ['No available players to substitute.'])
      );
      return;
    }

    const visible = filterPlayersBySearch(replaceCandidates, searchQuery);
    if (visible.length === 0) {
      list.append(
        el('p', { className: 'queue-dialog__empty' }, ['No players match your search.'])
      );
      return;
    }

    for (const candidate of visible) {
      list.append(
        renderReplaceCandidateButton(candidate, () => {
          onReplace(candidate.id);
          dialog.close();
        })
      );
    }

    mountLiveTimers(dialog);
  };

  if (replaceCandidates.length > 0) {
    panel.append(
      renderQueuePlayerSearch({
        inputId: 'queue-replace-player-search',
        label: 'Search players',
        placeholder: 'Search by name…',
        value: searchQuery,
        onInput: (query) => {
          searchQuery = query;
          renderReplaceList();
        },
      })
    );
  }

  panel.append(list);

  const actions = el('div', { className: 'queue-dialog__actions' });
  const backBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Back']);
  backBtn.addEventListener('click', () => {
    dialog.close();
    onBack();
  });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Cancel']);
  cancelBtn.addEventListener('click', () => dialog.close());
  actions.append(backBtn, cancelBtn);
  panel.append(actions);

  dialog = mountDialog('queue-dialog--replace', panel);
  renderReplaceList();

  const searchInput = panel.querySelector('#queue-replace-player-search') as HTMLInputElement | null;
  searchInput?.focus();

  dialog.addEventListener('close', () => clearLiveTimers(dialog));
}

/** Step 1: choose swap or replace, then open a dedicated modal for that action. */
export function openQueuePlayerEditDialog(options: QueuePlayerEditDialogOptions): void {
  openPlayerActionDialog(options);
}
