import { useQueueUiStore } from '@/stores/queueUiStore';

export const LADDER_NOTICE_TTL_MS = 12_000;

const ROOT_ATTR = 'data-ladder-notice-interval';

export function pruneExpiredLadderNotices(): boolean {
  const store = useQueueUiStore.getState();
  const fresh = store.ladderStartNotices.filter(
    (notice) => Date.now() - notice.createdAt < LADDER_NOTICE_TTL_MS
  );
  if (fresh.length === store.ladderStartNotices.length) {
    return false;
  }
  store.setLadderStartNotices(fresh);
  return true;
}

export function clearLadderNoticeRefresh(root: HTMLElement): void {
  const prev = root.getAttribute(ROOT_ATTR);
  if (prev) {
    clearInterval(Number(prev));
    root.removeAttribute(ROOT_ATTR);
  }
}

/** Re-render queue while ladder auto-start notices are visible. */
export function mountLadderNoticeRefresh(root: HTMLElement, onRefresh: () => void): void {
  clearLadderNoticeRefresh(root);
  pruneExpiredLadderNotices();

  if (useQueueUiStore.getState().ladderStartNotices.length === 0) {
    return;
  }

  const id = window.setInterval(() => {
    const hadExpired = pruneExpiredLadderNotices();
    if (hadExpired) {
      onRefresh();
    }
    if (useQueueUiStore.getState().ladderStartNotices.length === 0) {
      clearLadderNoticeRefresh(root);
    }
  }, 1000);

  root.setAttribute(ROOT_ATTR, String(id));
}
