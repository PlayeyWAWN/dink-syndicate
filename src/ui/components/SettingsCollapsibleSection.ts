import { el } from '@/lib/dom-utils';

export interface SettingsCollapsibleSectionOptions {
  title: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}

/** Collapsible settings card — used for all settings groups except Organizer. */
export function renderSettingsCollapsibleSection(
  children: HTMLElement[],
  options: SettingsCollapsibleSectionOptions
): HTMLElement {
  const { title, open, onToggle } = options;

  const details = el('details', {
    className: 'card settings-section settings-section--collapsible',
    ...(open ? { open: 'true' } : {}),
  });

  details.addEventListener('toggle', () => onToggle(details.open));

  const summary = el('summary', { className: 'settings-section__toggle' });
  summary.append(
    el('span', { className: 'settings-section__chevron', 'aria-hidden': 'true' }),
    el('span', { className: 'settings-section__title' }, [title]),
    el('span', { className: 'settings-section__collapsed-hint' }, [
      'Section hidden — tap header to show',
    ])
  );

  const body = el('div', { className: 'settings-section__body' });
  for (const child of children) {
    body.append(child);
  }

  details.append(summary, body);
  return details;
}
