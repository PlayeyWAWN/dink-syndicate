import { el } from '@/lib/dom-utils';
import { QueueMatchMode } from '@/config/queue-match-modes';
import {
  MAX_SYNERGY_PAIRS,
  getSynergyTeamLabel,
  playerInSynergyPair,
  synergyPairKey,
  validateNewSynergyPair,
} from '@/modules/matchmaking/synergyTeam';
import { useSessionStore } from '@/stores/sessionStore';
import { Player, isPlayerMatchable } from '@/types/player';

export interface SynergyTeamModalOptions {
  players: Player[];
  matchMode: QueueMatchMode;
  onSaved: () => void;
}

function sortedCandidates(players: Player[]): Player[] {
  return [...players]
    .filter(isPlayerMatchable)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function fillPlayerSelect(
  select: HTMLSelectElement,
  players: Player[],
  selectedId: string,
  excludeIds: Set<string>
): void {
  select.replaceChildren();
  const placeholder = el('option', { value: '' }, ['Select player…']) as HTMLOptionElement;
  placeholder.disabled = true;
  if (!selectedId) placeholder.selected = true;
  select.append(placeholder);

  for (const player of players) {
    if (excludeIds.has(player.id)) continue;
    const option = el('option', { value: player.id }, [player.name]) as HTMLOptionElement;
    if (player.id === selectedId) option.selected = true;
    select.append(option);
  }
}

/** Modal to create synergy teams with player dropdowns and optional team name. */
export function openSynergyTeamModal(options: SynergyTeamModalOptions): void {
  const { players, matchMode, onSaved } = options;
  const snapshot = useSessionStore.getState().loadSnapshot();
  const settings = snapshot?.settings;
  const pairs = settings?.synergyPairs ?? [];
  const teamNames = settings?.synergyTeamNames ?? {};
  const pairedIds = new Set(pairs.flat());
  const candidates = sortedCandidates(players);

  const dialog = el('dialog', { className: 'synergy-team-modal queue-dialog' }) as HTMLDialogElement;
  const form = el('form', { className: 'queue-dialog__form synergy-team-modal__form' });

  form.append(
    el('h2', { className: 'queue-dialog__title' }, ['Synergy Teams']),
    el('p', { className: 'queue-dialog__hint' }, [
      'Lock two players as permanent partners. When Synergy Team is on, Find Match and manual builds keep each pair on the same team.',
    ])
  );

  if (pairs.length > 0) {
    const list = el('ul', { className: 'synergy-team-modal__list' });
    pairs.forEach((pair) => {
      const row = el('li', { className: 'synergy-team-modal__team' });
      row.append(
        el('span', { className: 'synergy-team-modal__team-name' }, [
          getSynergyTeamLabel(pair, players, teamNames),
        ])
      );
      const removeBtn = el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm synergy-team-modal__remove-btn',
      }, ['Remove']);
      removeBtn.addEventListener('click', () => {
        const liveSettings = useSessionStore.getState().loadSnapshot()?.settings;
        const livePairs = liveSettings?.synergyPairs ?? [];
        const liveNames = liveSettings?.synergyTeamNames ?? {};
        const pairKey = synergyPairKey(pair);
        const nextPairs = livePairs.filter((item) => synergyPairKey(item) !== pairKey);
        const nextNames = { ...liveNames };
        delete nextNames[pairKey];
        useSessionStore.getState().updateSessionSettings({
          synergyPairs: nextPairs,
          synergyTeamNames: nextNames,
        });
        dialog.close();
        dialog.remove();
        options.onSaved();
        openSynergyTeamModal(options);
      });
      row.append(removeBtn);
      list.append(row);
    });
    form.append(
      el('h3', { className: 'queue-dialog__section-title' }, [
        `Active teams (${pairs.length}/${MAX_SYNERGY_PAIRS})`,
      ]),
      list
    );
  }

  if (pairs.length >= MAX_SYNERGY_PAIRS) {
    form.append(
      el('p', { className: 'queue-dialog__empty' }, [
        `Maximum ${MAX_SYNERGY_PAIRS} synergy teams per session. Remove one to add another.`,
      ])
    );
  } else if (candidates.length < 2) {
    form.append(
      el('p', { className: 'queue-dialog__empty' }, [
        'Need at least two checked-in players to create a synergy team.',
      ])
    );
  } else {
    const player1Field = el('div', { className: 'synergy-team-modal__field' });
    player1Field.append(
      el('label', { className: 'player-reg-modal__label', for: 'synergy-player-1' }, ['Player 1'])
    );
    const player1Select = el('select', {
      id: 'synergy-player-1',
      className: 'player-reg-modal__input synergy-team-modal__select',
      required: 'true',
    }) as HTMLSelectElement;

    const player2Field = el('div', { className: 'synergy-team-modal__field' });
    player2Field.append(
      el('label', { className: 'player-reg-modal__label', for: 'synergy-player-2' }, ['Player 2'])
    );
    const player2Select = el('select', {
      id: 'synergy-player-2',
      className: 'player-reg-modal__input synergy-team-modal__select',
      required: 'true',
    }) as HTMLSelectElement;

    const teamNameField = el('div', { className: 'synergy-team-modal__field' });
    teamNameField.append(
      el('label', { className: 'player-reg-modal__label', for: 'synergy-team-name' }, [
        'Team Name (optional)',
      ]),
      el('input', {
        id: 'synergy-team-name',
        type: 'text',
        className: 'player-reg-modal__input',
        placeholder: 'Auto-generate when empty',
        maxlength: '48',
      })
    );

    player1Field.append(player1Select);
    player2Field.append(player2Select);

    const refreshPlayer2Options = () => {
      const player1Id = player1Select.value;
      const exclude = new Set(pairedIds);
      if (player1Id) exclude.add(player1Id);
      fillPlayerSelect(player2Select, candidates, player2Select.value, exclude);
      if (player2Select.value && exclude.has(player2Select.value)) {
        player2Select.value = '';
      }
    };

    fillPlayerSelect(player1Select, candidates, '', pairedIds);
    refreshPlayer2Options();
    player1Select.addEventListener('change', refreshPlayer2Options);

    form.append(
      el('h3', { className: 'queue-dialog__section-title' }, ['Create team']),
      player1Field,
      player2Field,
      teamNameField
    );
  }

  const actions = el('div', { className: 'queue-dialog__actions' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Close']);
  cancelBtn.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
  });

  if (pairs.length < MAX_SYNERGY_PAIRS && candidates.length >= 2) {
    const createBtn = el('button', { type: 'submit', className: 'btn btn-success' }, [
      'Create team',
    ]);
    actions.append(cancelBtn, createBtn);
  } else {
    actions.append(cancelBtn);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (pairs.length >= MAX_SYNERGY_PAIRS) return;

    const player1Select = form.querySelector('#synergy-player-1') as HTMLSelectElement | null;
    const player2Select = form.querySelector('#synergy-player-2') as HTMLSelectElement | null;
    const teamNameInput = form.querySelector('#synergy-team-name') as HTMLInputElement | null;
    if (!player1Select || !player2Select) return;

    const playerA = players.find((player) => player.id === player1Select.value);
    const playerB = players.find((player) => player.id === player2Select.value);
    if (!playerA || !playerB) {
      alert('Select both players.');
      return;
    }

    const liveSettings = useSessionStore.getState().loadSnapshot()?.settings;
    const livePairs = liveSettings?.synergyPairs ?? [];
    const liveNames = liveSettings?.synergyTeamNames ?? {};

    const result = validateNewSynergyPair(playerA, playerB, livePairs, matchMode);
    if (!result.ok) {
      alert(result.message);
      return;
    }

    const nextPairs = [...livePairs, result.pair];
    const nextNames = { ...liveNames };
    const customName = teamNameInput?.value.trim() ?? '';
    if (customName) {
      nextNames[synergyPairKey(result.pair)] = customName;
    }

    useSessionStore.getState().updateSessionSettings({
      synergyPairs: nextPairs,
      synergyTeamNames: nextNames,
    });

    dialog.close();
    dialog.remove();
    options.onSaved();
    openSynergyTeamModal(options);
  });

  form.append(actions);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
}

export function isPlayerInSynergyPair(
  playerId: string,
  pairs: Array<[string, string]>
): boolean {
  return playerInSynergyPair(playerId, pairs) != null;
}

export function getSynergyPartnerName(
  playerId: string,
  players: Player[],
  pairs: Array<[string, string]>
): string | null {
  const pair = playerInSynergyPair(playerId, pairs);
  if (!pair) return null;
  const partnerId = pair[0] === playerId ? pair[1] : pair[0];
  return players.find((player) => player.id === partnerId)?.name ?? null;
}

export interface SynergyDisplayOptions {
  synergyTeamsEnabled: boolean;
  synergyPairs: Array<[string, string]>;
  rosterPlayers: Player[];
}

export function getSynergyChipLabel(
  playerId: string,
  options: SynergyDisplayOptions
): string | null {
  if (!options.synergyTeamsEnabled || options.synergyPairs.length === 0) return null;
  return getSynergyPartnerName(playerId, options.rosterPlayers, options.synergyPairs);
}
