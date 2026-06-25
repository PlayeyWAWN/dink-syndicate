import {
  canPromptInstall,
  dismissInstallPrompt,
  isAppInstalled,
  isInstallDismissed,
  shouldShowInstallUi,
  shouldShowIosInstallHint,
} from '@/lib/pwa-install';

describe('pwa-install', () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes('standalone') ? false : false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  it('detects installed standalone display mode', () => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    expect(isAppInstalled()).toBe(true);
    expect(shouldShowInstallUi()).toBe(false);
  });

  it('hides install UI when dismissed for the session', () => {
    dismissInstallPrompt();
    expect(isInstallDismissed()).toBe(true);
    expect(shouldShowInstallUi()).toBe(false);
  });

  it('does not show iOS hint when install prompt is unavailable on non-iOS', () => {
    expect(shouldShowIosInstallHint()).toBe(false);
    expect(canPromptInstall()).toBe(false);
  });
});
