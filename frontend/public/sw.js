/* mage2react service worker
 * ---------------------------------------------------------------------------
 * Hand-written (no Workbox). Provides:
 *   - offline shell (navigation fallback to /offline)
 *   - stale-while-revalidate for static assets & Magento /media
 *   - network-first with 3s timeout for HTML navigations
 *   - pass-through (no caching) for /graphql, /admin, /checkout, /customer,
 *     /api, /sales, /wishlist, /compare
 *   - LRU eviction at > 100 runtime entries
 *   - storage-quota guard: skip adds when estimate() usage > 90%
 *
 * Bump CACHE_NAME to invalidate on deploy.
 * ---------------------------------------------------------------------------
 */

const CACHE_NAME = 'm2r-v1';
const RUNTIME_CACHE = CACHE_NAME + '-runtime';
const MAX_RUNTIME_ENTRIES = 100;
const NAVIGATION_TIMEOUT_MS = 3000;

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/favicon.svg',
  '/manifest.webmanifest',
];

// URL prefixes that must NEVER be cached — stale data here is actively
// dangerous (cart/order/auth/etc).
const NEVER_CACHE_PREFIXES = [
  '/graphql',
  '/admin',
  '/checkout',
  '/customer',
  '/api',
  '/sales',
  '/wishlist',
  '/compare',
];

const STATIC_ASSET_EXTS = [
  '.css', '.js', '.mjs', '.woff2', '.woff', '.ttf',
  '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico',
];

const STATIC_ASSET_PREFIXES = [
  '/_astro/',
  '/_image',
  '/public/',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Use individual adds so one bad URL doesn't abort the whole install.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            // Best-effort — ignore failures for optional shell routes.
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function isNeverCache(url) {
  const path = url.pathname;
  for (let i = 0; i < NEVER_CACHE_PREFIXES.length; i++) {
    const p = NEVER_CACHE_PREFIXES[i];
    if (path === p || path.startsWith(p + '/') || path.startsWith(p + '?')) {
      return true;
    }
  }
  return false;
}

function isStaticAsset(url) {
  const path = url.pathname;
  for (let i = 0; i < STATIC_ASSET_PREFIXES.length; i++) {
    if (path.startsWith(STATIC_ASSET_PREFIXES[i])) return true;
  }
  const lower = path.toLowerCase();
  for (let i = 0; i < STATIC_ASSET_EXTS.length; i++) {
    if (lower.endsWith(STATIC_ASSET_EXTS[i])) return true;
  }
  return false;
}

function isMagentoMedia(url) {
  return url.pathname.startsWith('/media/');
}

function acceptsHtml(request) {
  const accept = request.headers.get('accept') || '';
  return request.mode === 'navigate' || accept.includes('text/html');
}

async function storageQuotaExceeded() {
  try {
    if (!navigator.storage || !navigator.storage.estimate) return false;
    const { usage, quota } = await navigator.storage.estimate();
    if (!usage || !quota) return false;
    return usage / quota > 0.9;
  } catch {
    return false;
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // FIFO eviction — `keys()` returns insertion order.
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

async function safePut(cacheName, request, response) {
  if (!response || !response.ok || response.status === 206) return;
  // Don't cache opaque or error responses; do allow basic & cors.
  if (response.type === 'opaqueredirect' || response.type === 'error') return;
  if (await storageQuotaExceeded()) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    // Fire-and-forget trim.
    trimCache(cacheName, MAX_RUNTIME_ENTRIES);
  } catch {
    // Quota or other write failure — not fatal.
  }
}

// ─── Strategies ─────────────────────────────────────────────────────────────
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function networkFirstHtml(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    // Stash a copy for offline use.
    safePut(RUNTIME_CACHE, request, response);
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const precached = await caches.match(request);
    if (precached) return precached;
    const offline = await caches.match('/offline');
    if (offline) return offline;
    return new Response(
      '<h1>Offline</h1><p>You appear to be offline and no cached copy is available.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      safePut(RUNTIME_CACHE, request, response);
      return response;
    })
    .catch(() => null);
  return cached || (await networkPromise) || fetch(request);
}

// ─── Fetch router ───────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET — POST/PUT/DELETE/etc pass through untouched.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Cross-origin: let the browser handle it natively.
  if (url.origin !== self.location.origin) return;

  // Hard-skip the sensitive paths.
  if (isNeverCache(url)) return;

  if (acceptsHtml(request)) {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  if (isStaticAsset(url) || isMagentoMedia(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: pass through, but opportunistically populate the cache so we can
  // serve it when offline. Never block on the cache write.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          safePut(RUNTIME_CACHE, request, response);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('network error and no cache');
      })
  );
});

// ─── Message channel (for client-triggered skipWaiting) ─────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
