import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/config/firebase-app';
import { isFirebaseEnabled } from '@/config/firebase';
import { el, clearElement } from '@/lib/dom-utils';
import { FIRESTORE_PATHS } from '@/modules/live/firestore-paths';
import { startWallboardViewerPresence } from '@/modules/live/WallboardViewerPresenceService';
import { sponsorConfigService } from '@/modules/live/SponsorConfigService';
import { LiveSessionSnapshot, SponsorConfig } from '@/types/live';
import { hasActiveWallboardRankAlerts } from '@/ui/components/wallboard/wallboard-rank-alerts';
import {
  mountWallboardTimers,
  renderWallboardActiveMatches,
  renderWallboardHeader,
  renderWallboardMatchHistory,
  renderWallboardQueue,
  renderWallboardRankings,
  renderWallboardSponsors,
  resolveWallboardPlayers,
} from '@/ui/components/wallboard/WallboardSections';

export function parseLiveWallboardToken(pathname: string): string | null {
  const match = pathname.match(/^\/live\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

export async function bootstrapLiveWallboard(root: HTMLElement, token: string): Promise<void> {
  document.body.classList.add('live-wallboard-body');
  root.className = 'live-wallboard-root';

  if (!isFirebaseEnabled()) {
    root.append(el('p', { className: 'live-wallboard__error' }, ['Live wallboard is unavailable.']));
    return;
  }

  const db = getFirebaseFirestore();
  if (!db) {
    root.append(el('p', { className: 'live-wallboard__error' }, ['Live wallboard is unavailable.']));
    return;
  }

  let historyPage = 0;
  let presenceHandle: { stop: () => void } | null = null;
  let sponsorConfig: SponsorConfig = { sponsorsEnabled: false, sponsors: [], updatedAt: 0 };
  let lastSnapshot: LiveSessionSnapshot | null = null;
  let alertRefreshTimer: number | null = null;

  const render = (snapshot: LiveSessionSnapshot | null, inactive = false): void => {
    clearElement(root);

    if (!snapshot || inactive || !snapshot.isActive) {
      root.append(
        el('div', { className: 'live-wallboard live-wallboard--inactive' }, [
          el('img', { className: 'live-wallboard__logo', src: '/images/logo.webp', alt: 'Dink Syndicate' }),
          el('h1', {}, ['This wallboard link is no longer active']),
          el('p', {}, ['Ask the queue master for an updated link.']),
        ])
      );
      return;
    }

    const players = resolveWallboardPlayers(
      snapshot.players,
      snapshot.activeMatches,
      snapshot.completedMatches,
      snapshot.rankings
    );

    const container = el('div', { className: 'live-wallboard' });
    container.append(renderWallboardHeader(snapshot.organizerName, snapshot.updatedAt));

    const body = el('div', { className: 'live-wallboard__body' });
    body.append(renderWallboardActiveMatches(snapshot.activeMatches, players));

    body.append(
      renderWallboardQueue(snapshot.queueNext, players),
      renderWallboardRankings(snapshot.rankings),
      renderWallboardMatchHistory(
        snapshot.completedMatches,
        players,
        (page) => {
          historyPage = page;
          render(snapshot);
        },
        historyPage
      )
    );

    const sponsors = renderWallboardSponsors(sponsorConfig);
    if (sponsors) body.append(sponsors);

    container.append(body);
    root.append(container);
    mountWallboardTimers(container);
  };

  const scheduleAlertRefresh = (): void => {
    if (alertRefreshTimer) return;
    alertRefreshTimer = window.setInterval(() => {
      if (!lastSnapshot || !hasActiveWallboardRankAlerts()) {
        if (alertRefreshTimer) {
          window.clearInterval(alertRefreshTimer);
          alertRefreshTimer = null;
        }
        return;
      }
      render(lastSnapshot);
    }, 1000);
  };

  const sponsorUnsub = sponsorConfigService.subscribe((config) => {
    sponsorConfig = config;
    if (lastSnapshot) {
      render(lastSnapshot);
    }
  });

  presenceHandle = startWallboardViewerPresence(token);

  const sessionRef = doc(db, FIRESTORE_PATHS.liveSession(token));
  const unsub = onSnapshot(
    sessionRef,
    (snap) => {
      if (!snap.exists()) {
        lastSnapshot = null;
        render(null, true);
        return;
      }
      lastSnapshot = snap.data() as LiveSessionSnapshot;
      render(lastSnapshot);
      if (hasActiveWallboardRankAlerts()) {
        scheduleAlertRefresh();
      }
    },
    () => {
      root.replaceChildren(
        el('p', { className: 'live-wallboard__error' }, ['Waiting for connection…'])
      );
    }
  );

  window.addEventListener('beforeunload', () => {
    unsub();
    sponsorUnsub();
    presenceHandle?.stop();
    if (alertRefreshTimer) window.clearInterval(alertRefreshTimer);
  });
}
