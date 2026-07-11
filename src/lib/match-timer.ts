/** Live match / queue wait / available-player timers. */

export const AVAILABLE_WAIT_WARN_MS = 10 * 60 * 1000;
export const AVAILABLE_WAIT_CRITICAL_MS = 15 * 60 * 1000;

export interface LiveTimerOptions {
  availableWaitWarnMs?: number;
  availableWaitCriticalMs?: number;
  onPauseExpired?: () => void;
}

export function formatMatchDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatQueueWaitDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${m}m ${String(s).padStart(2, '0')}s`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${s}s`;
}

const TIMER_ROOT_ATTR = 'data-live-timer-interval';

export function clearLiveTimers(root: HTMLElement): void {
  const prevId = root.getAttribute(TIMER_ROOT_ATTR);
  if (prevId) {
    clearInterval(Number(prevId));
    root.removeAttribute(TIMER_ROOT_ATTR);
  }
}

/** Tick `[data-started-at]`, `[data-queued-at]`, `[data-lineup-filled-at]`, and `[data-available-since]` elements under root. */
export function mountLiveTimers(root: HTMLElement, options?: LiveTimerOptions): void {
  clearLiveTimers(root);

  const warnMs = options?.availableWaitWarnMs ?? AVAILABLE_WAIT_WARN_MS;
  const criticalMs = options?.availableWaitCriticalMs ?? AVAILABLE_WAIT_CRITICAL_MS;
  const onPauseExpired = options?.onPauseExpired;
  let pauseExpiredFired = false;

  const tick = (): void => {
    const now = Date.now();
    root.querySelectorAll('[data-started-at]').forEach((node) => {
      const started = Number(node.getAttribute('data-started-at'));
      if (Number.isFinite(started)) {
        node.textContent = formatMatchDuration(now - started);
      }
    });
    root.querySelectorAll('[data-queued-at]').forEach((node) => {
      const queued = Number(node.getAttribute('data-queued-at'));
      if (Number.isFinite(queued)) {
        node.textContent = formatQueueWaitDuration(now - queued);
      }
    });
    root.querySelectorAll('[data-lineup-filled-at]').forEach((node) => {
      const filled = Number(node.getAttribute('data-lineup-filled-at'));
      if (Number.isFinite(filled)) {
        node.textContent = formatMatchDuration(now - filled);
      }
    });
    root.querySelectorAll('[data-available-since]').forEach((node) => {
      const since = Number(node.getAttribute('data-available-since'));
      if (!Number.isFinite(since)) return;

      const elapsed = now - since;
      node.textContent = formatMatchDuration(elapsed);

      const card =
        node.closest('.available-player-card') ??
        node.closest('.win-lose-stack__item') ??
        node.closest('.win-lose-stack__lineup-slot');
      if (!card) return;

      card.classList.remove(
        'available-player-card--waiting-warn',
        'available-player-card--waiting-critical',
        'win-lose-stack__item--waiting-warn',
        'win-lose-stack__item--waiting-critical',
        'win-lose-stack__lineup-slot--waiting-warn',
        'win-lose-stack__lineup-slot--waiting-critical'
      );
      if (
        card.classList.contains('available-player-card--selected') ||
        card.classList.contains('win-lose-stack__item--selected')
      ) {
        return;
      }

      const isAvailableCard = card.classList.contains('available-player-card');
      const isStackItem = card.classList.contains('win-lose-stack__item');
      const warnClass = isAvailableCard
        ? 'available-player-card--waiting-warn'
        : isStackItem
          ? 'win-lose-stack__item--waiting-warn'
          : 'win-lose-stack__lineup-slot--waiting-warn';
      const criticalClass = isAvailableCard
        ? 'available-player-card--waiting-critical'
        : isStackItem
          ? 'win-lose-stack__item--waiting-critical'
          : 'win-lose-stack__lineup-slot--waiting-critical';

      if (elapsed >= criticalMs) {
        card.classList.add(criticalClass);
      } else if (elapsed >= warnMs) {
        card.classList.add(warnClass);
      }
    });

    root.querySelectorAll('[data-paused-until]').forEach((node) => {
      const until = Number(node.getAttribute('data-paused-until'));
      if (!Number.isFinite(until)) return;

      const remaining = until - now;
      node.textContent = formatMatchDuration(Math.max(0, remaining));

      if (remaining <= 0 && onPauseExpired && !pauseExpiredFired) {
        pauseExpiredFired = true;
        onPauseExpired();
      }
    });
  };

  tick();
  const id = window.setInterval(tick, 1000);
  root.setAttribute(TIMER_ROOT_ATTR, String(id));
}
