import { APP_VERSION } from '@/config/constants';

/** Compare semver-like strings. Returns 1 if a>b, -1 if a<b, 0 if equal. */
export function compareAppVersions(a: string, b: string): number {
  const pa = String(a || '')
    .trim()
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '')
    .trim()
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function getDocumentAppVersion(): string | null {
  const meta = document.querySelector('meta[name="app-version"]');
  return meta?.getAttribute('content')?.trim() ?? null;
}

export function getRuntimeAppVersion(): string {
  return getDocumentAppVersion() ?? APP_VERSION;
}

/** Reload without unregistering SW or clearing caches (offline-safe refresh). */
export function refreshDinkSyndicateApp(reason?: string): void {
  try {
    const key = 'dinksyndicate_last_reload_ts';
    const now = Date.now();
    const last = parseInt(sessionStorage.getItem(key) ?? '', 10) || 0;
    if (now - last < 4500) {
      console.warn('[Dink] Skipping duplicate reload:', reason ?? '');
      return;
    }
    sessionStorage.setItem(key, String(now));
  } catch {
    /* ignore */
  }
  window.location.reload();
}
