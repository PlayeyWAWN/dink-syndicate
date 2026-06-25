import { el } from '@/lib/dom-utils';
import {
  getAvailableTtsVoices,
  isTtsSupported,
  speakText,
  TTS_TEST_PHRASE,
} from '@/lib/tts-service';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsUiStore } from '@/stores/settingsUiStore';
import { renderSettingsCollapsibleSection } from '@/ui/components/SettingsCollapsibleSection';

function formatVoiceLabel(name: string, lang: string, isDefault: boolean, isNetwork: boolean): string {
  const parts = [name];
  if (lang) parts.push(`(${lang})`);
  if (isDefault) parts.push('default');
  if (isNetwork) parts.push('network');
  return parts.join(' — ');
}

export function renderTtsSettingsPanel(): HTMLElement {
  const voiceField = el('div', { className: 'player-form__field' });
  voiceField.append(
    el('label', { className: 'player-form__label', for: 'tts-voice-select' }, ['Announce voice'])
  );

  const voiceSelect = el('select', {
    id: 'tts-voice-select',
    className: 'settings-input',
    'aria-describedby': 'tts-voice-hint',
  }) as HTMLSelectElement;

  const voiceHint = el('p', {
    id: 'tts-voice-hint',
    className: 'screen-lead settings-preview',
  }, [
    'The list is built from your device. If it is empty, wait a few seconds or tap Refresh.',
  ]);

  const repopulateVoiceSelect = (): void => {
    const saved = useSessionStore.getState().loadSnapshot()?.settings?.ttsVoiceUri ?? '';
    if (!isTtsSupported()) {
      voiceSelect.innerHTML = '';
      voiceSelect.append(
        el('option', { value: '' }, ['Text to speech is not available in this browser'])
      );
      voiceSelect.disabled = true;
      return;
    }

    voiceSelect.disabled = false;
    voiceSelect.innerHTML = '';
    voiceSelect.append(el('option', { value: '' }, ['Browser default (automatic)']));

    for (const voice of getAvailableTtsVoices()) {
      voiceSelect.append(
        el('option', { value: voice.voiceURI }, [
          formatVoiceLabel(voice.name, voice.lang, voice.isDefault, voice.isNetwork),
        ])
      );
    }

    const hasSaved = Array.from(voiceSelect.options).some((option) => option.value === saved);
    voiceSelect.value = hasSaved ? saved : '';
  };

  repopulateVoiceSelect();
  if (isTtsSupported()) {
    window.speechSynthesis.addEventListener('voiceschanged', repopulateVoiceSelect);
  }

  voiceSelect.addEventListener('change', () => {
    const value = voiceSelect.value;
    useSessionStore.getState().updateSessionSettings({
      ttsVoiceUri: value || undefined,
    });
  });

  const refreshBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
  }, ['Refresh voice list']);
  refreshBtn.addEventListener('click', repopulateVoiceSelect);

  const testBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
  }, ['Test voice']);
  testBtn.addEventListener('click', () => {
    if (!isTtsSupported()) {
      alert('Text to speech is not available in this browser.');
      return;
    }
    try {
      speakText(TTS_TEST_PHRASE, voiceSelect.value || undefined);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not play test voice.');
    }
  });

  if (!isTtsSupported()) {
    refreshBtn.disabled = true;
    testBtn.disabled = true;
  }

  const actions = el('div', { className: 'action-row' });
  actions.append(refreshBtn, testBtn);

  voiceField.append(voiceSelect, voiceHint, actions);

  const settingsUi = useSettingsUiStore.getState();

  return renderSettingsCollapsibleSection(
    [
      el('p', { className: 'screen-lead' }, [
        'Default voice for the Announce button on queued matches.',
      ]),
      voiceField,
    ],
    {
      title: 'Text to speech',
      open: settingsUi.ttsSectionOpen,
      onToggle: (open) => useSettingsUiStore.getState().setTtsSectionOpen(open),
    }
  );
}
