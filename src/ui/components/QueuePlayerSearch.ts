import { el } from '@/lib/dom-utils';

export interface QueuePlayerSearchOptions {
  inputId: string;
  label: string;
  placeholder?: string;
  value: string;
  onInput: (query: string) => void;
}

/** Search field for queue available/excluded player lists. */
export function renderQueuePlayerSearch(options: QueuePlayerSearchOptions): HTMLElement {
  const { inputId, label, placeholder = 'Search by name…', value, onInput } = options;

  const wrap = el('div', { className: 'queue-player-search' });
  const labelEl = el('label', {
    className: 'queue-player-search__label',
    for: inputId,
  }, [label]);

  const input = el('input', {
    type: 'search',
    id: inputId,
    className: 'queue-player-search__input',
    placeholder,
    value,
    autocomplete: 'off',
    enterkeyhint: 'search',
  }) as HTMLInputElement;

  input.addEventListener('input', () => onInput(input.value));

  wrap.append(labelEl, input);
  return wrap;
}
