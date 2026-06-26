import { el } from '@/lib/dom-utils';
import { QueueMatchMode } from '@/config/queue-match-modes';
import { useSessionStore } from '@/stores/sessionStore';
import { Player } from '@/types/player';
import { openSynergyTeamModal } from '@/ui/components/SynergyTeamModal';

export interface PlayersSynergyControlsOptions {
  players: Player[];
  matchMode: QueueMatchMode;
  onRefresh: () => void;
}

/** Compact Synergy Team toggle + manage button for the Players tab. */
export function renderPlayersSynergyControls(options: PlayersSynergyControlsOptions): HTMLElement {
  const { players, matchMode, onRefresh } = options;
  const settings = useSessionStore.getState().loadSnapshot()?.settings;
  const enabled = settings?.synergyTeamsEnabled === true;
  const pairCount = settings?.synergyPairs?.length ?? 0;

  const row = el('div', { className: 'players-synergy-bar card' });

  const toggleLabel = el('label', { className: 'players-synergy-bar__toggle' });
  const toggleInput = el('input', {
    type: 'checkbox',
    className: 'players-synergy-bar__checkbox',
  }) as HTMLInputElement;
  toggleInput.checked = enabled;
  toggleInput.addEventListener('change', () => {
    useSessionStore.getState().updateSessionSettings({
      synergyTeamsEnabled: toggleInput.checked,
    });
    onRefresh();
  });
  toggleLabel.append(
    toggleInput,
    el('span', { className: 'players-synergy-bar__toggle-label' }, ['Synergy Team'])
  );

  const actions = el('div', { className: 'players-synergy-bar__actions' });
  if (enabled) {
    const manageBtn = el('button', {
      type: 'button',
      className: 'btn btn-small players-synergy-bar__manage-btn',
    }, ['Synergy']);
    manageBtn.addEventListener('click', () => {
      openSynergyTeamModal({
        players,
        matchMode,
        onSaved: onRefresh,
      });
    });
    actions.append(manageBtn);
    if (pairCount > 0) {
      actions.append(
        el('span', { className: 'players-synergy-bar__count' }, [
          `${pairCount} team${pairCount === 1 ? '' : 's'}`,
        ])
      );
    }
  }

  row.append(
    el('div', { className: 'players-synergy-bar__info' }, [
      toggleLabel,
      el('p', { className: 'players-synergy-bar__hint' }, [
        enabled
          ? 'Locked pairs stay together in Find Match and manual builds.'
          : 'Off — saved teams are kept but not enforced.',
      ]),
    ]),
    actions
  );

  return row;
}
