import { el } from '@/lib/dom-utils';
import { useQueueStore } from '@/stores/queueStore';
import { useSessionStore } from '@/stores/sessionStore';
import { appRouter } from '@/app/router';
import { getGameMode } from '@/modules/game-mode/getGameMode';
import { GAME_MODE_OPTIONS, GameMode } from '@/types/game-mode';
import { renderSettingsCollapsibleSection } from '@/ui/components/SettingsCollapsibleSection';
import { useSettingsUiStore } from '@/stores/settingsUiStore';

export function renderGameModeSettingsSection(): HTMLElement {
  const snapshot = useSessionStore.getState().loadSnapshot();
  const settings = snapshot?.settings;
  const currentGameMode = getGameMode(settings);
  const settingsUi = useSettingsUiStore.getState();

  const gameModeGroup = el('div', {
    className: 'game-mode-group',
    role: 'radiogroup',
    'aria-label': 'Game mode',
  });

  for (const option of GAME_MODE_OPTIONS) {
    const isActive = currentGameMode === option.id;
    const card = el('label', {
      className: `game-mode-card${isActive ? ' game-mode-card--active' : ''}`,
    });
    const radio = el('input', {
      type: 'radio',
      name: 'game-mode',
      value: option.id,
      checked: isActive ? 'true' : undefined,
    }) as HTMLInputElement;
    card.append(
      radio,
      el('span', { className: 'game-mode-card__title' }, [option.label]),
      el('span', { className: 'game-mode-card__desc' }, [option.shortDescription])
    );
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const nextMode = option.id as GameMode;
      if (nextMode === getGameMode(useSessionStore.getState().loadSnapshot()?.settings)) {
        return;
      }

      const activeMatches = useQueueStore.getState().queueState.activeMatches.length;
      if (activeMatches > 0) {
        alert('Finish or cancel all active matches before changing game mode.');
        radio.checked = false;
        const currentRadio = gameModeGroup.querySelector(
          `input[value="${currentGameMode}"]`
        ) as HTMLInputElement | null;
        if (currentRadio) currentRadio.checked = true;
        return;
      }

      const confirmed = window.confirm(
        `Switch to ${option.label}?\n\n` +
          '• Clears the match queue and rotation state\n' +
          '• Checked-in players are re-seeded for the new mode\n' +
          '• Completed match history and player stats are kept'
      );
      if (!confirmed) {
        radio.checked = false;
        const currentRadio = gameModeGroup.querySelector(
          `input[value="${currentGameMode}"]`
        ) as HTMLInputElement | null;
        if (currentRadio) currentRadio.checked = true;
        return;
      }

      useSessionStore.getState().updateSessionSettings({ gameMode: nextMode });
      useQueueStore.getState().resetForGameModeChange(nextMode);
      appRouter.navigate(
        nextMode === 'win_lose_stack' || nextMode === 'ladder_waterfall' ? 'queue' : 'settings'
      );
    });
    gameModeGroup.append(card);
  }

  return renderSettingsCollapsibleSection(
    [
      el('p', { className: 'screen-lead' }, [
        'Choose how players rotate for the session. Stack and Ladder modes use automatic court rotation with partner shuffle.',
      ]),
      gameModeGroup,
    ],
    {
      title: 'Game mode',
      open: settingsUi.gameModeSectionOpen,
      onToggle: (open) => useSettingsUiStore.getState().setGameModeSectionOpen(open),
    }
  );
}
