// SigLens Service Worker.
//
// 이 워커가 하는 일은 딱 두 가지다.
//  1. 오프라인일 때 페이지 이동에 `/offline.html`을 대신 보여 준다.
//  2. 같은 출처의 `/_next/static/`(파일명에 해시가 박힌 불변 자산)을 cache-first로 준다.
//
// 그 밖의 요청(교차 출처, GET 아닌 요청, RSC `_rsc` 페치, API, 이미지·폰트 등)은
// `respondWith`를 부르지 않고 **그냥 흘려보낸다** — 브라우저가 SW를 거치지 않은 것과
// 똑같이 처리한다. 예전(siglens-v1)에는 모든 GET을 `respondWith(fetch())`로 감싸
// 페이지 이동·RSC 페치마다 SW 왕복이 끼었고, 어떤 출처의 png/svg/woff든(불투명·
// 오류 응답까지) 버전 없는 캐시에 쌓아 배포마다 옛 청크가 무한히 늘었다.

// 캐시 이름에 버전을 싣는다. activate가 아래 두 이름 외의 캐시를 전부 지우므로,
// 캐시 형태가 바뀌는 배포(프리캐시 목록·오프라인 페이지·런타임 정책 변경)에서
// 이 값을 올리면 옛 캐시가 정리된다. 해시 자산은 **용량 상한**(MAX_STATIC_ENTRIES)
// 이 따로 막으므로 평범한 배포마다 올릴 필요는 없다.
const CACHE_VERSION = 'v2';
const PRECACHE_NAME = `siglens-precache-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `siglens-static-${CACHE_VERSION}`;
const KEEP_CACHES = [PRECACHE_NAME, STATIC_CACHE_NAME];

const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL];

// 해시 자산 캐시의 항목 상한. 배포가 거듭되면 옛 해시 청크가 더는 요청되지 않는데
// 그대로 남으므로, 상한을 넘으면 **가장 먼저 넣은 항목부터** 지운다(Cache API의
// keys()는 삽입 순서를 보장한다). 한 배포의 첫 로드에 필요한 청크는 수십 개
// 수준이라 몇 배포치를 담기에 충분하다.
const MAX_STATIC_ENTRIES = 150;

const STATIC_PREFIX = '/_next/static/';

// 실시간 데이터 — 서브리소스 요청은 절대 가로채지 않는다(이동은 fetch 핸들러 주석 참고).
const BYPASS_PREFIXES = ['/api/', '/_next/data/'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(PRECACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
    );
    // skipWaiting() activates the new SW immediately. The client-side
    // registration listens for `controllerchange` and performs a soft
    // reload so HTML and hashed JS come from the same generation.
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            caches
                .keys()
                .then(keys =>
                    Promise.all(
                        keys
                            .filter(key => !KEEP_CACHES.includes(key))
                            .map(key => caches.delete(key))
                    )
                ),
            // 페이지 이동을 가로채는 비용을 없앤다 — SW가 부팅하는 동안 브라우저가
            // 이미 네트워크 요청을 시작하고, 핸들러는 그 응답(preloadResponse)을
            // 그대로 돌려준다. 미지원 브라우저는 핸들러가 직접 fetch한다.
            self.registration.navigationPreload
                ? self.registration.navigationPreload.enable()
                : Promise.resolve(),
        ])
    );
    self.clients.claim();
});

/** 페이지 이동: 네트워크(가능하면 navigation preload) → 실패 시 오프라인 페이지. */
async function handleNavigation(event) {
    try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(event.request);
    } catch {
        const offline = await caches.match(OFFLINE_URL);
        return offline ?? Response.error();
    }
}

/** 상한을 넘은 만큼 가장 오래된 항목부터 지운다. */
async function trimCache(cache, maxEntries) {
    const keys = await cache.keys();
    const excess = keys.length - maxEntries;
    if (excess <= 0) return;
    await Promise.all(keys.slice(0, excess).map(key => cache.delete(key)));
}

/** 해시 자산: cache-first. 정상(200대)·같은 출처(basic) 응답만 담는다. */
async function handleStaticAsset(event) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(
            cache
                .put(event.request, copy)
                .then(() => trimCache(cache, MAX_STATIC_ENTRIES))
        );
    }
    return response;
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    // 페이지 이동은 navigation preload를 켰으므로 **반드시** preloadResponse를 소비한다.
    // 여기서 그냥 흘려보내면 브라우저가 preload 응답을 버리고 같은 문서를 한 번 더
    // 요청한다(Chrome은 "preload request was cancelled" 경고를 남긴다). 그래서 이동은
    // 경로와 무관하게(`/api/` 콜백 포함) 이 분기에서 처리한다 — 온라인이면 네트워크
    // 응답을 그대로 돌려줄 뿐이라 우회와 결과가 같다.
    if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(event));
        return;
    }

    const url = new URL(request.url);
    // 교차 출처(애널리틱스·광고·CDN 폰트 등)는 손대지 않는다.
    if (url.origin !== self.location.origin) return;
    if (BYPASS_PREFIXES.some(prefix => url.pathname.startsWith(prefix))) {
        return;
    }

    if (url.pathname.startsWith(STATIC_PREFIX)) {
        event.respondWith(handleStaticAsset(event));
    }
    // 나머지(RSC 페치, 이미지, 매니페스트 등)는 가로채지 않는다.
});
