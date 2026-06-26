import { el } from '@/lib/dom-utils';
import { isFirebaseEnabled } from '@/config/firebase';
import { isOnline } from '@/lib/offline-utils';
import { livePublishService } from '@/modules/live/LivePublishService';

export interface LivePublishPanelOptions {
  onChange: () => void;
}

export function renderLivePublishPanel(options: LivePublishPanelOptions): HTMLElement {
  const section = el('section', { className: 'live-publish-panel queue-section' });
  section.append(
    el('div', { className: 'queue-section__header' }, [
      el('h2', { className: 'queue-section__title' }, ['Live Wallboard']),
    ]),
    el('p', { className: 'live-publish-panel__lead' }, [
      'Share a read-only link so anyone can watch your queue on a TV or phone.',
    ])
  );

  if (!isFirebaseEnabled()) {
    section.append(
      el('p', { className: 'live-publish-panel__notice' }, [
        'Sign in with Firebase to publish a live wallboard.',
      ])
    );
    return section;
  }

  if (!isOnline()) {
    section.append(
      el('p', { className: 'live-publish-panel__notice' }, [
        'You are offline. Publishing requires an internet connection.',
      ])
    );
    return section;
  }

  const enabled = livePublishService.isPublishEnabled();
  const token = livePublishService.getPublishToken();
  const url = token ? livePublishService.buildWallboardUrl(token) : '';

  const toggleLabel = el('label', { className: 'live-publish-panel__toggle' });
  const toggle = el('input', {
    type: 'checkbox',
    checked: enabled ? 'true' : undefined,
  }) as HTMLInputElement;
  toggleLabel.append(toggle, el('span', {}, [' Publish Live Wallboard']));

  const status = el('div', { className: 'live-publish-panel__status' });
  const viewerLine = el('p', { className: 'live-publish-panel__viewers' }, ['']);
  const statsLine = el('p', { className: 'live-publish-panel__stats' }, ['']);
  const syncLine = el('p', { className: 'live-publish-panel__sync' }, ['']);

  const linkRow = el('div', { className: 'live-publish-panel__link-row' });
  const linkInput = el('input', {
    type: 'text',
    className: 'settings-input live-publish-panel__link',
    readonly: 'true',
    value: url,
  }) as HTMLInputElement;
  const copyBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Copy link']);
  const regenBtn = el('button', { type: 'button', className: 'btn btn-secondary' }, ['Regenerate link']);

  copyBtn.addEventListener('click', async () => {
    if (!linkInput.value) return;
    try {
      await navigator.clipboard.writeText(linkInput.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy link';
      }, 2000);
    } catch {
      alert('Could not copy link');
    }
  });

  let viewerUnsub: (() => void) | undefined;

  const refreshStatus = (): void => {
    const last = livePublishService.getLastSyncedAt();
    syncLine.textContent = last
      ? `Last synced ${new Date(last).toLocaleTimeString()}`
      : '';
  };

  const bindViewerListener = (): void => {
    viewerUnsub?.();
    viewerUnsub = undefined;
    if (!token || !enabled) {
      viewerLine.textContent = '';
      statsLine.textContent = '';
      return;
    }
    viewerUnsub = livePublishService.subscribeViewerCount(token, (count) => {
      viewerLine.textContent = `👁 ${count} watching now`;
    });
  };

  regenBtn.addEventListener('click', async () => {
    if (!confirm('Regenerate link? The old link will stop working.')) return;
    regenBtn.setAttribute('disabled', 'true');
    const result = await livePublishService.regenerateToken();
    regenBtn.removeAttribute('disabled');
    if (result.ok) {
      linkInput.value = result.url;
      bindViewerListener();
      refreshStatus();
      options.onChange();
    } else {
      alert(result.message);
    }
  });

  toggle.addEventListener('change', async () => {
    toggle.setAttribute('disabled', 'true');
    if (toggle.checked) {
      const result = await livePublishService.enablePublish();
      toggle.removeAttribute('disabled');
      if (result.ok) {
        linkInput.value = result.url;
        linkRow.hidden = false;
        bindViewerListener();
        refreshStatus();
        options.onChange();
      } else {
        toggle.checked = false;
        alert(result.message);
      }
    } else {
      await livePublishService.disablePublish();
      toggle.removeAttribute('disabled');
      linkInput.value = '';
      linkRow.hidden = true;
      viewerUnsub?.();
      viewerLine.textContent = '';
      statsLine.textContent = '';
      options.onChange();
    }
  });

  linkRow.append(linkInput, copyBtn, regenBtn);
  linkRow.hidden = !enabled;
  status.append(viewerLine, statsLine, syncLine);

  section.append(toggleLabel, linkRow, regenBtn, status);
  if (enabled) {
    bindViewerListener();
    refreshStatus();
    void livePublishService.syncSnapshot();
  }

  section.addEventListener('DOMNodeRemoved', () => viewerUnsub?.());

  return section;
}
