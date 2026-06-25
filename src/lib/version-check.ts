import { APP_VERSION, STORAGE_KEYS } from '@/config/constants';

const PERIODIC_CHECK_MS = 30_000;
const VERSION_CHECK_QUERY = 'version-check';

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

export function getStoredAppVersion(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.APP_VERSION);
    return stored?.trim() || null;
  } catch {
    return null;
  }
}

export function setStoredAppVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.APP_VERSION, version.trim());
  } catch {
    /* ignore */
  }
}

/** Parse app-version meta from an HTML string fetched from the server. */
export function parseAppVersionFromHtml(html: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.querySelector('meta[name="app-version"]')?.getAttribute('content')?.trim() ?? null;
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

/** Clear Cache Storage buckets then reload (used on deploy upgrades). */
export async function clearAppCachesAndReload(reason?: string): Promise<void> {
  if ('caches' in window) {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (error) {
      console.warn('[Dink] Cache clear failed:', error);
    }
  }
  refreshDinkSyndicateApp(reason);
}

function versionCheckUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set(VERSION_CHECK_QUERY, String(Date.now()));
  return url.toString();
}

/** Fetch index.html from the server and return its app-version, if any. */
export async function fetchServerAppVersion(): Promise<string | null> {
  const response = await fetch(versionCheckUrl(), {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!response.ok) return null;
  const html = await response.text();
  return parseAppVersionFromHtml(html);
}

/** If the server reports a newer version, stamp storage and reload immediately. */
export async function checkServerForNewVersion(reason: string): Promise<boolean> {
  if (!navigator.onLine) return false;

  try {
    const serverVersion = await fetchServerAppVersion();
    if (!serverVersion) return false;

    const stored = getStoredAppVersion() ?? getRuntimeAppVersion();
    if (compareAppVersions(serverVersion, stored) <= 0) return false;

    console.info('[Dink] New version on server — reloading', {
      stored,
      server: serverVersion,
      reason,
    });
    setStoredAppVersion(serverVersion);
    setTimeout(() => refreshDinkSyndicateApp(reason), 500);
    return true;
  } catch {
    return false;
  }
}

let periodicCheckStarted = false;

/** Poll the server every 30s when online (Smash Syndicate parity). */
export function startPeriodicVersionCheck(): void {
  if (periodicCheckStarted || typeof window === 'undefined') return;
  periodicCheckStarted = true;

  window.setInterval(() => {
    void checkServerForNewVersion('periodic-server-newer');
  }, PERIODIC_CHECK_MS);
}

/** Apply a version reported by the service worker and reload immediately. */
export function applyServiceWorkerVersionUpgrade(newVersion: string): void {
  const stored = getStoredAppVersion();
  if (stored && compareAppVersions(newVersion, stored) <= 0) return;
  setStoredAppVersion(newVersion);
  setTimeout(() => refreshDinkSyndicateApp('sw-version-updated'), 500);
}
