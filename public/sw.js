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
