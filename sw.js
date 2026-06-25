// Dink Syndicate PWA service worker — cache-first app shell (offline-first)
// Keep APP_VERSION in sync with index.html meta app-version

const APP_VERSION = '0.2.0';
const CACHE_NAME = `dink-syndicate-${APP_VERSION}`;

const OFFLINE_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dink Syndicate — Offline</title><style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:24rem;margin:auto;text-align:center;background:#1b4332;color:#d8f3dc}button{margin-top:1rem;padding:.6rem 1.2rem;font-size:1rem;border-radius:8px;border:none;background:#40916c;color:#fff;cursor:pointer}</style></head><body><h1>You're offline</h1><p>Connect to load the latest shell, or reopen from your home screen if you've visited before.</p><p><button type="button" onclick="location.reload()">Retry</button></p></body></html>`;

function offlineNavigationResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

const SW_SCOPE = (self.registration && self.registration.scope) || '/';
const scopePath = (path) => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalizedScope = SW_SCOPE.endsWith('/') ? SW_SCOPE.slice(0, -1) : SW_SCOPE;
  return `${normalizedScope}${path.startsWith('/') ? path : `/${path}`}`;
};

const PRECACHE_URLS = [
  scopePath('/'),
  scopePath('/index.html'),
  scopePath('/sw.js'),
  scopePath('/manifest.json'),
  scopePath('/favicon.svg'),
  scopePath('/images/logo.webp'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const doc = (await cache.match(scopePath('/index.html'))) || (await cache.match(scopePath('/')));
      if (doc) return doc;
      return offlineNavigationResponse();
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigate = request.mode === 'navigate' || request.destination === 'document';
  const isStatic =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/css/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.json') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.svg';

  if (isNavigate || isStatic) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
