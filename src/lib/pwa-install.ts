/** Capture and trigger the PWA install prompt (Chrome/Edge/Android). */

const INSTALL_DISMISS_KEY = 'dinksyndicate_install_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Call once at app startup — before the first `beforeinstallprompt` may fire. */
export function initPwaInstallListener(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    clearInstallDismissed();
    notifyListeners();
  });
}

export function subscribePwaInstall(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function canPromptInstall(): boolean {
  return deferredPrompt != null && !isAppInstalled();
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** iOS Safari has no install prompt API — show manual Add to Home Screen steps. */
export function shouldShowIosInstallHint(): boolean {
  return isIosDevice() && !isAppInstalled() && !canPromptInstall();
}

export function isInstallDismissed(): boolean {
  try {
    return sessionStorage.getItem(INSTALL_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  try {
    sessionStorage.setItem(INSTALL_DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

function clearInstallDismissed(): void {
  try {
    sessionStorage.removeItem(INSTALL_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldShowInstallUi(): boolean {
  if (isAppInstalled() || isInstallDismissed()) return false;
  return canPromptInstall() || shouldShowIosInstallHint();
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notifyListeners();
  return outcome;
}
