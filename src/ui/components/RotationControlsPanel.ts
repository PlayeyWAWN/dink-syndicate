import { el } from '@/lib/dom-utils';
import { useQueueStore } from '@/stores/queueStore';

export interface RotationControlsOptions {
  onNavigate: () => void;
}

/** Stop / resume auto-rotation for Win/Lose Stack and Ladder/Waterfall modes. */
export function renderRotationControls(options: RotationControlsOptions): HTMLElement {
  const { onNavigate } = options;
  const queueState = useQueueStore.getState().queueState;
  const paused = queueState.rotationPaused === true;
  const activeCount = queueState.activeMatches.length;

  const wrap = el('div', { className: 'rotation-controls' });

  if (paused) {
    wrap.append(
      el('div', { className: 'rotation-controls__banner rotation-controls__banner--paused', role: 'status' }, [
        el('strong', { className: 'rotation-controls__banner-title' }, ['Rotation paused']),
        el('p', { className: 'rotation-controls__banner-body' }, [
          activeCount > 0
            ? `Auto-start is off. Finish or cancel ${activeCount} active match${activeCount === 1 ? '' : 'es'}, then use Settings → End session & archive to save stats. Only completed games count toward rankings.`
            : 'Auto-start is off. Use Settings → End session & archive when you are done. Only completed games count toward rankings.',
        ]),
      ])
    );

    const resumeBtn = el('button', {
      type: 'button',
      className: 'btn btn-success rotation-controls__btn',
    }, ['Resume rotation']);
    resumeBtn.addEventListener('click', () => {
      useQueueStore.getState().resumeRotation();
      onNavigate();
    });
    wrap.append(resumeBtn);
    return wrap;
  }

  wrap.append(
    el('p', { className: 'screen-lead rotation-controls__lead' }, [
      'When you are done for the night, stop rotation before ending the session so new games are not dealt automatically.',
    ])
  );

  const stopBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary rotation-controls__btn',
  }, ['Stop rotation']);
  stopBtn.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Stop rotation?\n\n' +
        '• No new games will start automatically\n' +
        '• You can still record winners on active matches\n' +
        '• Cancelled matches will not be replaced\n\n' +
        'When finished, go to Settings → End session & archive.'
    );
    if (!confirmed) return;
    useQueueStore.getState().stopRotation();
    onNavigate();
  });

  wrap.append(stopBtn);
  return wrap;
}
