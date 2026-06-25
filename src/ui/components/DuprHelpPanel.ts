import { DUPR_SCALE_TIERS } from '@/config/dupr-scale';
import { el } from '@/lib/dom-utils';

/** Collapsible DUPR scale reference for add-player and rating fields. */
export function renderDuprHelpPanel(options?: { id?: string }): HTMLElement {
  const panelId = options?.id ?? 'dupr-help-panel';

  const list = el('ul', { className: 'dupr-help__list' });
  for (const tier of DUPR_SCALE_TIERS) {
    list.append(
      el('li', { className: 'dupr-help__item' }, [
        el('strong', {}, [`${tier.range}:`]),
        ` ${tier.description}`,
      ])
    );
  }

  const details = el('details', { className: 'dupr-help', id: panelId });
  details.append(
    el('summary', { className: 'dupr-help__summary' }, [
      'What is DUPR? How do I find my rating?',
    ]),
    el('div', { className: 'dupr-help__body' }, [
      el('h4', { className: 'dupr-help__title' }, ['The DUPR Scale']),
      list,
      el('p', { className: 'dupr-help__note' }, [
        'Enter your best estimate for queue balancing. This is organizer-entered only — not linked to official DUPR until Phase 3.',
      ]),
    ])
  );

  return details;
}
