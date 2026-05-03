// Service Worker cache name.
//
// IMPORTANT: bump this version on every deploy that ships breaking cache
// changes (new precache entries, removed/renamed routes, changed offline
// fallback). The activate handler purges any cache whose name does not
// match CACHE_NAME, so bumping is what triggers stale-cache cleanup.
//
// We could not adopt build-time substitution here without invasive build
// changes (Next does not pipe a per-deploy ID into public/* by default
// and a meta-tag handshake adds runtime complexity). The manual-bump
// policy is the lowest-risk option for now.
const CACHE_NAME = 'siglens-v1';

// Only precache the offline fallback page at install time.
// Next.js static assets use hashed filenames (unknown at install time),
// so they are cached at runtime on first access instead.
const PRECACHE_URLS = ['/offline.html'];

// These paths must NEVER be cached — real-time data
const BYPASS_PREFIXES = ['/api/', '/_next/data/'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)),
    );
    // skipWaiting() activates the new SW immediately. The client-side
    // registration listens for `controllerchange` and performs a soft
    // reload so the freshly-activated SW does not serve stale cached
    // HTML against newly-loaded hashed JS chunks (hydration mismatch).
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(k => k !== CACHE_NAME)
                        .map(k => caches.delete(k)),
                ),
            ),
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Real-time data paths — bypass SW entirely
    if (BYPASS_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) return;

    event.respondWith(
        fetch(request)
            .then(response => {
                // Cache Next.js static assets and public images at runtime
                if (
                    url.pathname.startsWith('/_next/static/') ||
                    /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/.test(url.pathname)
                ) {
                    const clone = response.clone();
                    caches
                        .open(CACHE_NAME)
                        .then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() =>
                caches.match(request).then(cached => {
                    if (cached) return cached;
                    if (request.headers.get('accept')?.includes('text/html')) {
                        return (
                            caches.match('/offline.html') ?? Response.error()
                        );
                    }
                    return Response.error();
                }),
            ),
    );
});
