import { el } from '@/lib/dom-utils';
import { useQueueStore } from '@/stores/queueStore';
import { isAutoRotationEnabled } from '@/types/queue';
import { renderCollapsibleHelpPanel } from '@/ui/components/CollapsibleHelpPanel';

export type AutoRotationMode = 'ladder' | 'stack';

export interface RotationControlsOptions {
  onNavigate: () => void;
  mode: AutoRotationMode;
}

const AUTO_ROTATION_COPY: Record<
  AutoRotationMode,
  { manualLead: string; autoLead: string; autoDetail: string }
> = {
  ladder: {
    manualLead:
      'Manual mode — assign waiting-pool players to benches yourself, then use Start ready games.',
    autoLead: 'Auto-rotation is on.',
    autoDetail:
      'Backfills open benches from the waiting pool (fewest games played first). After each result, winners move up one court and losers move down; partners split on the next lineup. Courts with four players start automatically.',
  },
  stack: {
    manualLead:
      'Manual mode — tap waiting players from either stack to fill Next lineup above (Team 1, then Team 2). Tap a name again to remove, or Clear to reset. Start next game when four are selected.',
    autoLead: 'Auto-rotation is on.',
    autoDetail:
      'Routes winners and losers to their stacks after each game, alternates Next-Up between Winners and Losers piles, shuffles partners, and starts the next game when four players are ready.',
  },
};

/** Auto-rotation toggle for Win/Lose Stack and Ladder/Waterfall modes (off by default). */
export function renderRotationControls(options: RotationControlsOptions): HTMLElement {
  const { onNavigate, mode } = options;
  const queueState = useQueueStore.getState().queueState;
  const autoOn = isAutoRotationEnabled(queueState);
  const copy = AUTO_ROTATION_COPY[mode];
  const activeCount = queueState.activeMatches.length;

  const wrap = el('div', { className: 'rotation-controls' });

  if (autoOn) {
    wrap.append(
      el('div', { className: 'rotation-controls__banner rotation-controls__banner--on', role: 'status' }, [
        el('strong', { className: 'rotation-controls__banner-title' }, [copy.autoLead]),
        el('p', { className: 'rotation-controls__banner-body' }, [copy.autoDetail]),
        ...(activeCount > 0
          ? [
              el('p', { className: 'rotation-controls__banner-note' }, [
                `${activeCount} active match${activeCount === 1 ? '' : 'es'} in progress.`,
              ]),
            ]
          : []),
      ])
    );
  } else {
    wrap.append(
      renderCollapsibleHelpPanel(
        [
          el('p', { className: 'rotation-controls__lead' }, [copy.manualLead]),
          el('p', { className: 'rotation-controls__hint' }, [
            'Tap Auto-rotation to let the app handle bench fill, player movement, and starting games using the rules above.',
          ]),
        ],
        {
          title: 'Manual mode & auto-rotation',
          collapsedHint: 'Tap for rotation details',
          className: 'collapsible-help--compact',
        }
      )
    );
  }

  const toggleBtn = el('button', {
    type: 'button',
    className: autoOn
      ? 'btn btn-success rotation-controls__btn rotation-controls__btn--on'
      : 'btn btn-secondary rotation-controls__btn',
    'aria-pressed': autoOn ? 'true' : 'false',
  }, [autoOn ? 'Auto-rotation: On' : 'Auto-rotation']);

  toggleBtn.addEventListener('click', () => {
    if (autoOn) {
      useQueueStore.getState().stopRotation();
    } else {
      useQueueStore.getState().resumeRotation();
    }
    onNavigate();
  });

  wrap.append(toggleBtn);
  return wrap;
}
