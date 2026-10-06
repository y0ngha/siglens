// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

/**
 * `public/sw.js`는 번들 밖 평문 스크립트라 import할 수 없다. 원문을 가짜 SW 전역
 * (`self`·`caches`·`fetch`) 위에서 실행하고, 등록된 핸들러에 이벤트를 흘려 넣어
 * **무엇을 가로채고 무엇을 흘려보내는지**를 단언한다.
 */
const SW_SOURCE = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');
const ORIGIN = 'https://siglens.io';

type Listener = (event: FakeEvent) => void;

interface FakeEvent {
    request?: Request;
    preloadResponse?: Promise<Response | undefined>;
    respondWith: ReturnType<typeof vi.fn>;
    waitUntil: ReturnType<typeof vi.fn>;
}

interface FakeCache {
    store: Map<string, Response>;
    match: (request: Request | string) => Promise<Response | undefined>;
    put: (request: Request, response: Response) => Promise<void>;
    keys: () => Promise<Request[]>;
    delete: (request: Request) => Promise<boolean>;
    addAll: (urls: string[]) => Promise<void>;
}

interface Harness {
    listeners: Map<string, Listener>;
    cacheStore: Map<string, FakeCache>;
    fetchMock: ReturnType<typeof vi.fn>;
    enablePreload: ReturnType<typeof vi.fn>;
}

function keyOf(request: Request | string): string {
    return typeof request === 'string'
        ? new URL(request, ORIGIN).href
        : request.url;
}

function createCache(): FakeCache {
    const store = new Map<string, Response>();
    return {
        store,
        match: async request => store.get(keyOf(request))?.clone(),
        put: async (request, response) => {
            store.set(keyOf(request), response);
        },
        keys: async () => [...store.keys()].map(url => new Request(url)),
        delete: async request => store.delete(keyOf(request)),
        addAll: async urls => {
            for (const url of urls) {
                store.set(keyOf(url), new Response(`precached ${url}`));
            }
        },
    };
}

function loadServiceWorker(initialCaches: string[] = []): Harness {
    const listeners = new Map<string, Listener>();
    const cacheStore = new Map<string, FakeCache>(
        initialCaches.map(name => [name, createCache()])
    );
    const fetchMock = vi.fn();
    const enablePreload = vi.fn().mockResolvedValue(undefined);
    const caches = {
        open: async (name: string) => {
            const existing = cacheStore.get(name);
            if (existing) return existing;
            const created = createCache();
            cacheStore.set(name, created);
            return created;
        },
        keys: async () => [...cacheStore.keys()],
        delete: async (name: string) => cacheStore.delete(name),
        match: async (request: Request | string) => {
            for (const cache of cacheStore.values()) {
                const hit = await cache.match(request);
                if (hit) return hit;
            }
            return undefined;
        },
    };
    const self = {
        location: new URL(ORIGIN),
        registration: { navigationPreload: { enable: enablePreload } },
        addEventListener: (type: string, listener: Listener) => {
            listeners.set(type, listener);
        },
        skipWaiting: vi.fn(),
        clients: { claim: vi.fn() },
    };
    runInNewContext(SW_SOURCE, {
        self,
        caches,
        fetch: fetchMock,
        Response,
        Request,
        URL,
        Promise,
    });
    return { listeners, cacheStore, fetchMock, enablePreload };
}

function createEvent(
    request: Request,
    preloadResponse?: Promise<Response | undefined>
): FakeEvent {
    return {
        request,
        preloadResponse: preloadResponse ?? Promise.resolve(undefined),
        respondWith: vi.fn(),
        waitUntil: vi.fn(),
    };
}

function dispatchFetch(harness: Harness, event: FakeEvent): void {
    const listener = harness.listeners.get('fetch');
    if (!listener) throw new Error('fetch listener not registered');
    listener(event);
}

async function respondedWith(event: FakeEvent): Promise<Response> {
    expect(event.respondWith).toHaveBeenCalledTimes(1);
    return (await event.respondWith.mock.calls[0][0]) as Response;
}

async function settleWaitUntil(event: FakeEvent): Promise<void> {
    await Promise.all(event.waitUntil.mock.calls.map(call => call[0]));
}

/** `Request`는 `mode: 'navigate'`를 생성자로 받지 않으므로 속성만 덮는다. */
function navigationRequest(path: string): Request {
    const request = new Request(`${ORIGIN}${path}`);
    Object.defineProperty(request, 'mode', { value: 'navigate' });
    return request;
}

/** fetch가 만드는 같은 출처 응답처럼 `type: 'basic'`을 갖게 한다. */
function basicResponse(body: string, status = 200): Response {
    const response = new Response(body, { status });
    Object.defineProperty(response, 'type', { value: 'basic' });
    return response;
}

describe('public/sw.js', () => {
    describe('fetch 가로채기 범위', () => {
        it.each([
            [
                'GET 아닌 요청',
                new Request(`${ORIGIN}/_next/static/a.js`, { method: 'POST' }),
            ],
            [
                '교차 출처 요청',
                new Request(
                    'https://static.cloudflareinsights.com/beacon.min.js'
                ),
            ],
            ['교차 출처 이미지', new Request('https://example.com/logo.png')],
            ['RSC 페치', new Request(`${ORIGIN}/AAPL?_rsc=abc`)],
            ['API 요청', new Request(`${ORIGIN}/api/bars`)],
            ['같은 출처 public 이미지', new Request(`${ORIGIN}/icon96.png`)],
        ])('%s는 respondWith를 부르지 않는다', (_label, request) => {
            const harness = loadServiceWorker();
            const event = createEvent(request);
            dispatchFetch(harness, event);
            expect(event.respondWith).not.toHaveBeenCalled();
            expect(harness.fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('페이지 이동', () => {
        it('navigation preload 응답이 있으면 다시 fetch하지 않고 그대로 돌려준다', async () => {
            const harness = loadServiceWorker();
            const preloaded = new Response('preloaded html');
            const event = createEvent(
                navigationRequest('/AAPL'),
                Promise.resolve(preloaded)
            );
            dispatchFetch(harness, event);
            expect(await respondedWith(event)).toBe(preloaded);
            expect(harness.fetchMock).not.toHaveBeenCalled();
        });

        it('preload가 없으면 네트워크로 가져온다', async () => {
            const harness = loadServiceWorker();
            const network = new Response('network html');
            harness.fetchMock.mockResolvedValue(network);
            const event = createEvent(navigationRequest('/market'));
            dispatchFetch(harness, event);
            expect(await respondedWith(event)).toBe(network);
        });

        it('네트워크가 실패하면 프리캐시한 오프라인 페이지를 준다', async () => {
            const harness = loadServiceWorker();
            const installEvent = createEvent(new Request(ORIGIN));
            harness.listeners.get('install')?.(installEvent);
            await settleWaitUntil(installEvent);

            harness.fetchMock.mockRejectedValue(new TypeError('offline'));
            const event = createEvent(navigationRequest('/market'));
            dispatchFetch(harness, event);
            const response = await respondedWith(event);
            expect(await response.text()).toBe('precached /offline.html');
        });
    });

    describe('/_next/static/ 해시 자산', () => {
        it('정상 basic 응답은 담고, 다음 요청은 네트워크 없이 캐시에서 준다', async () => {
            const harness = loadServiceWorker();
            harness.fetchMock.mockResolvedValue(basicResponse('chunk'));
            const url = `${ORIGIN}/_next/static/chunks/app.js`;

            const first = createEvent(new Request(url));
            dispatchFetch(harness, first);
            await respondedWith(first);
            await settleWaitUntil(first);

            const second = createEvent(new Request(url));
            dispatchFetch(harness, second);
            const cached = await respondedWith(second);
            expect(await cached.text()).toBe('chunk');
            expect(harness.fetchMock).toHaveBeenCalledTimes(1);
        });

        it('오류 응답(404)은 캐시하지 않는다', async () => {
            const harness = loadServiceWorker();
            harness.fetchMock.mockResolvedValue(basicResponse('missing', 404));
            const event = createEvent(
                new Request(`${ORIGIN}/_next/static/chunks/gone.js`)
            );
            dispatchFetch(harness, event);
            expect((await respondedWith(event)).status).toBe(404);
            await settleWaitUntil(event);
            expect(event.waitUntil).not.toHaveBeenCalled();
            expect(
                harness.cacheStore.get('siglens-static-v2')?.store.size ?? 0
            ).toBe(0);
        });

        it('basic이 아닌 응답(opaque 등)은 캐시하지 않는다', async () => {
            const harness = loadServiceWorker();
            harness.fetchMock.mockResolvedValue(new Response('cors'));
            const event = createEvent(
                new Request(`${ORIGIN}/_next/static/media/font.woff2`)
            );
            dispatchFetch(harness, event);
            await respondedWith(event);
            expect(event.waitUntil).not.toHaveBeenCalled();
        });

        it('항목 상한(150)을 넘으면 가장 오래된 항목부터 지운다', async () => {
            const harness = loadServiceWorker();
            harness.fetchMock.mockImplementation(async () =>
                basicResponse('chunk')
            );
            for (let index = 0; index < 152; index += 1) {
                const event = createEvent(
                    new Request(`${ORIGIN}/_next/static/chunks/${index}.js`)
                );
                dispatchFetch(harness, event);
                await respondedWith(event);
                await settleWaitUntil(event);
            }
            const store = harness.cacheStore.get('siglens-static-v2')?.store;
            expect(store?.size).toBe(150);
            expect(store?.has(`${ORIGIN}/_next/static/chunks/0.js`)).toBe(
                false
            );
            expect(store?.has(`${ORIGIN}/_next/static/chunks/1.js`)).toBe(
                false
            );
            expect(store?.has(`${ORIGIN}/_next/static/chunks/151.js`)).toBe(
                true
            );
        });
    });

    describe('activate', () => {
        it('현재 버전이 아닌 캐시(siglens-v1 등)를 지우고 navigation preload를 켠다', async () => {
            const harness = loadServiceWorker([
                'siglens-v1',
                'siglens-precache-v2',
                'siglens-static-v2',
            ]);
            const event = createEvent(new Request(ORIGIN));
            harness.listeners.get('activate')?.(event);
            await settleWaitUntil(event);
            expect([...harness.cacheStore.keys()]).toEqual([
                'siglens-precache-v2',
                'siglens-static-v2',
            ]);
            expect(harness.enablePreload).toHaveBeenCalledTimes(1);
        });
    });
});
