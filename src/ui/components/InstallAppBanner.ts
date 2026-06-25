import { APP_NAME } from '@/config/constants';
import { el } from '@/lib/dom-utils';
import {
  canPromptInstall,
  dismissInstallPrompt,
  promptInstall,
  shouldShowIosInstallHint,
  shouldShowInstallUi,
} from '@/lib/pwa-install';
import { appRouter } from '@/app/router';

export interface InstallAppBannerOptions {
  onDismiss?: () => void;
}

/** Homepage banner with install button or iOS Add to Home Screen hint. */
export function renderInstallAppBanner(options: InstallAppBannerOptions = {}): HTMLElement | null {
  if (!shouldShowInstallUi()) return null;

  const banner = el('div', { className: 'notice-banner notice-banner--install' });
  banner.append(
    el('div', { className: 'notice-banner__title' }, [`Install ${APP_NAME}`]),
    el('div', { className: 'notice-banner__body' }, [
      shouldShowIosInstallHint()
        ? 'Add to your home screen for quick access and full offline use. Tap Share, then choose Add to Home Screen.'
        : 'Add to your home screen or app drawer for quick access and full offline use.',
    ])
  );

  const actions = el('div', { className: 'notice-banner__actions' });

  if (canPromptInstall()) {
    const installBtn = el('button', {
      type: 'button',
      className: 'btn btn-success notice-banner__install-btn',
    }, ['Install app']);
    installBtn.addEventListener('click', async () => {
      const outcome = await promptInstall();
      if (outcome === 'accepted' || outcome === 'dismissed') {
        appRouter.navigate('home');
      }
    });
    actions.append(installBtn);
  }

  const dismissBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
  }, ['Not now']);
  dismissBtn.addEventListener('click', () => {
    dismissInstallPrompt();
    options.onDismiss?.();
    appRouter.navigate('home');
  });
  actions.append(dismissBtn);

  banner.append(actions);

  return banner;
}
