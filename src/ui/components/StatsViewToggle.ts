import { el } from '@/lib/dom-utils';
import { StatsView } from '@/types/player';

const VIEW_LABELS: Record<StatsView, string> = {
  session: 'This session',
  career: 'Career',
};

/** Segmented control for session vs career stats. */
export function renderStatsViewToggle(
  activeView: StatsView,
  onChange: (view: StatsView) => void
): HTMLElement {
  const track = el('div', {
    className: 'stats-view-toggle',
    role: 'group',
    'aria-label': 'Stats view',
  });

  for (const view of ['session', 'career'] as const) {
    const isActive = activeView === view;
    const button = el('button', {
      type: 'button',
      className: `stats-view-toggle__btn${isActive ? ' stats-view-toggle__btn--active' : ''}`,
      'aria-pressed': String(isActive),
    }, [VIEW_LABELS[view]]);
    button.addEventListener('click', () => onChange(view));
    track.append(button);
  }

  return track;
}
