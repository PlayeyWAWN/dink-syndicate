import { el } from '@/lib/dom-utils';

export interface CollapsibleHelpPanelOptions {
  title: string;
  collapsedHint?: string;
  className?: string;
}

/** Collapsed-by-default help text — saves vertical space on mobile. */
export function renderCollapsibleHelpPanel(
  content: HTMLElement[],
  options: CollapsibleHelpPanelOptions
): HTMLElement {
  const { title, collapsedHint = 'Tap to expand', className = '' } = options;

  const details = el('details', {
    className: `collapsible-help${className ? ` ${className}` : ''}`,
  });

  const summary = el('summary', { className: 'collapsible-help__toggle' });
  summary.append(
    el('span', { className: 'collapsible-help__chevron', 'aria-hidden': 'true' }),
    el('span', { className: 'collapsible-help__title' }, [title]),
    el('span', { className: 'collapsible-help__hint' }, [collapsedHint])
  );

  const body = el('div', { className: 'collapsible-help__body' });
  for (const child of content) {
    body.append(child);
  }

  details.append(summary, body);
  return details;
}
