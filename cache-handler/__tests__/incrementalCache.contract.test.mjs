// 핸들러를 **실제 Next 16.3.8 IncrementalCache**에 꽂아 판정 결과를 확인하는 계약 테스트.
//
// 핸들러의 stale 표현(nextInternals.mjs `staleLastModified`)과 cacheControl 재시드는 Next
// 내부 계산과 정확히 맞물려야만 의미가 있다. 핸들러만 단위 테스트하면 "핸들러가 의도한 값을
// 돌려준다"까지만 보이고, Next가 그 값을 실제로 stale로 읽는지는 보이지 않는다
// (TESTING.md#TE-8 — mock이 아니라 실물로 계약을 확인).
// Next를 올렸을 때 이 파일이 깨지면 nextInternals.mjs의 인용부터 다시 확인할 것.

import { vi } from 'vitest';

const { s3Objects } = vi.hoisted(() => ({ s3Objects: new Map() }));

// S3는 직렬화까지 실제로 태운 인메모리 버킷으로 대체한다 — cacheControl 영속이 v8+gzip
// 왕복을 견디는지도 함께 본다.
vi.mock('../s3Store.mjs', async () => {
    const { serialize, deserialize } = await import('../serialize.mjs');
    const slot = (key, kind) =>
        `${kind === 'FETCH' ? 'fetch' : 'pages'}:${key}`;
    return {
        lookupEntry: async (key, kind) => {
            const buf = s3Objects.get(slot(key, kind));
            return buf
                ? { status: 'hit', entry: await deserialize(buf) }
                : { status: 'not-found', entry: null };
        },
        setEntry: async (key, kind, entry) => {
            s3Objects.set(slot(key, kind), await serialize(entry));
        },
    };
});
vi.mock('../config.mjs', () => ({
    config: { disabled: false, buildPhase: false },
}));
// 원격 태그 로그 없이 로컬 판정만 본다.
vi.mock('../upstashRest.mjs', () => ({
    isUpstashConfigured: () => false,
    zaddGreater: vi.fn(),
    zrangeFromScore: vi.fn(),
    zremBelowScore: vi.fn(),
    serverTimeMs: vi.fn(),
    expireKey: vi.fn(),
}));

import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach } from 'vitest';
import CacheHandler, { __resetForTests as resetHandler } from '../index.mjs';
import { _resetForTest as resetTags } from '../tagStore.mjs';
import { __resetForTests as resetPageMem } from '../pageMemStore.mjs';
import { drainUploads } from '../uploadQueue.mjs';

const require = createRequire(import.meta.url);
const {
    IncrementalCache,
} = require('next/dist/server/lib/incremental-cache/index.js');
const {
    SharedCacheControls,
} = require('next/dist/server/lib/incremental-cache/shared-cache-controls.external.js');
const { CACHE_ONE_YEAR_SECONDS } = require('next/dist/lib/constants.js');

// revalidateTag(tag, 'max')가 핸들러에 넘기는 durations(revalidation-utils.js:119-123).
const MAX_DURATIONS = { expire: 31536000 };
const ROUTE_CACHE_CONTROL = { revalidate: 3600, expire: 31536000 };

// 16.3.8부터 페이지 계열 get/set은 응답을 만든 소스 라우트(owner)를 요구하고, 핸들러에는
// 그 owner로 스코프된 키가 넘어온다(route-cache-key.js `getRouteCacheKey`). 모양은
// RouteModule이 만드는 것과 같다(route-cache-key.js `getResponseCacheOwner` — App은 `page`).
const SYMBOL_OWNER = { kind: 'APP_PAGE', sourceRoute: '/[symbol]/page' };
const ROOT_OWNER = { kind: 'APP_PAGE', sourceRoute: '/page' };

function newIncrementalCache(prerenderRoutes = {}) {
    return new IncrementalCache({
        dev: false,
        flushToDisk: false,
        minimalMode: false,
        requestHeaders: {},
        maxMemoryCacheSize: 0,
        getPrerenderManifest: () => ({
            version: 4,
            routes: prerenderRoutes,
            dynamicRoutes: {},
            notFoundRoutes: [],
            preview: { previewModeId: 'test' },
        }),
        fetchCacheKeyPrefix: '',
        CurCacheHandler: CacheHandler,
        allowedRevalidateHeaderKeys: [],
    });
}

/** 같은 밀리초 안의 무효화는 `>` 판정에 걸리지 않는다 — 시각을 확실히 넘긴다. */
function tick() {
    return new Promise(resolve => setTimeout(resolve, 5));
}

/** 프로세스 재시작: Next 메모리(공유 cacheControls)와 핸들러 메모리 계층이 비워진다. */
function simulateRestart() {
    new SharedCacheControls({ routes: {}, dynamicRoutes: {} }).clear();
    resetPageMem();
    resetHandler();
}

const PAGE_VALUE = {
    kind: 'APP_PAGE',
    html: '<html>AAPL</html>',
    rscData: Buffer.from('rsc'),
    headers: { 'x-next-cache-tags': 'seo-snapshot:AAPL,_N_T_/AAPL' },
    postponed: undefined,
    status: 200,
    segmentData: undefined,
};

beforeEach(() => {
    s3Objects.clear();
    resetTags();
    simulateRestart();
});

describe('APP_PAGE × 실제 IncrementalCache', () => {
    async function seedPage() {
        const ic = newIncrementalCache();
        await ic.set('/AAPL', PAGE_VALUE, {
            cacheControl: ROUTE_CACHE_CONTROL,
            route: SYMBOL_OWNER,
        });
        expect(await drainUploads(1_000)).toBe(0);
        await tick();
        return ic;
    }

    it('쓴 직후는 fresh(HIT)', async () => {
        const ic = await seedPage();
        const entry = await ic.get('/AAPL', {
            kind: 'APP_PAGE',
            isFallback: false,
            route: SYMBOL_OWNER,
        });
        expect(entry.isStale).toBeUndefined();
        expect(entry.value.html).toBe(PAGE_VALUE.html);
    });

    it("revalidateTag(tag, 'max') 뒤에는 isStale === true(SWR) — 블로킹 miss가 아니다", async () => {
        const ic = await seedPage();
        await ic.revalidateTag(['seo-snapshot:AAPL'], MAX_DURATIONS);

        const entry = await ic.get('/AAPL', {
            kind: 'APP_PAGE',
            isFallback: false,
            route: SYMBOL_OWNER,
        });
        // ResponseCache는 isStale === true면 이 값으로 먼저 응답하고 백그라운드로
        // 재생성한다(response-cache/index.js:210-216). -1이면 블로킹이다.
        expect(entry.isStale).toBe(true);
        expect(entry.value.html).toBe(PAGE_VALUE.html);
        expect(entry.cacheControl).toEqual(ROUTE_CACHE_CONTROL);
    });

    it('durations 없는 무효화(updateTag)는 miss — 블로킹 재생성', async () => {
        const ic = await seedPage();
        await ic.revalidateTag(['seo-snapshot:AAPL']);
        expect(
            await ic.get('/AAPL', {
                kind: 'APP_PAGE',
                isFallback: false,
                route: SYMBOL_OWNER,
            })
        ).toBeNull();
    });

    it('재시작 후 첫 읽기도 영속한 cacheControl로 HIT — STALE·Cache-Control 누락 없음', async () => {
        await seedPage();
        simulateRestart();

        const entry = await newIncrementalCache().get('/AAPL', {
            kind: 'APP_PAGE',
            isFallback: false,
            route: SYMBOL_OWNER,
        });
        expect(entry.isStale).toBeUndefined();
        expect(entry.cacheControl).toEqual(ROUTE_CACHE_CONTROL);
    });

    it('재시작 후 stale 무효화도 isStale === true', async () => {
        await seedPage();
        simulateRestart();
        await newIncrementalCache().revalidateTag(
            ['seo-snapshot:AAPL'],
            MAX_DURATIONS
        );

        const entry = await newIncrementalCache().get('/AAPL', {
            kind: 'APP_PAGE',
            isFallback: false,
            route: SYMBOL_OWNER,
        });
        expect(entry.isStale).toBe(true);
    });

    it('프리렌더 매니페스트에 있는 라우트도 stale 무효화가 isStale === true', async () => {
        await seedPage();
        simulateRestart();
        const routes = {
            // 16.3.8은 매니페스트 값도 소유 라우트가 맞을 때만 쓴다
            // (route-cache-key.js `isRouteCacheOwner` — dataRoute 확장자로 kind, srcRoute로 소유자).
            '/AAPL': {
                initialRevalidateSeconds: 3600,
                initialExpireSeconds: 31536000,
                dataRoute: '/AAPL.rsc',
                srcRoute: '/[symbol]',
            },
        };
        await newIncrementalCache(routes).revalidateTag(
            ['seo-snapshot:AAPL'],
            MAX_DURATIONS
        );
        const entry = await newIncrementalCache(routes).get('/AAPL', {
            kind: 'APP_PAGE',
            isFallback: false,
            route: SYMBOL_OWNER,
        });
        expect(entry.isStale).toBe(true);
    });
});

describe('APP_PAGE 키 × 실제 IncrementalCache (16.3.8 라우트 스코프 키)', () => {
    it('핸들러는 Next가 소스 라우트로 스코프한 키를 받는다', async () => {
        const seen = vi.spyOn(CacheHandler.prototype, 'set');
        await newIncrementalCache().set('/AAPL', PAGE_VALUE, {
            cacheControl: ROUTE_CACHE_CONTROL,
            route: SYMBOL_OWNER,
        });
        expect(seen.mock.calls[0][0]).toMatch(
            /^\/route-cache\/APP_PAGE\/[0-9a-f]{64}\/\$\/AAPL$/
        );
        // owner는 Next가 떼어 내고 넘긴다 — 핸들러는 키만으로 일한다.
        expect(seen.mock.calls[0][2]).not.toHaveProperty('route');
        seen.mockRestore();
    });

    it('루트 페이지(`/` → `$/index`)도 재시작 후 영속한 cacheControl로 HIT', async () => {
        // 16.3.6의 toRoute 정규화를 그대로 쓰면 `…/$/index`를 `…/$`로 바꿔 Next가 읽는 키와
        // 어긋난다 — 이 경로가 그 회귀를 잡는다.
        await newIncrementalCache().set('/', PAGE_VALUE, {
            cacheControl: ROUTE_CACHE_CONTROL,
            route: ROOT_OWNER,
        });
        expect(await drainUploads(1_000)).toBe(0);
        await tick();
        simulateRestart();

        const entry = await newIncrementalCache().get('/', {
            kind: 'APP_PAGE',
            isFallback: false,
            route: ROOT_OWNER,
        });
        expect(entry.isStale).toBeUndefined();
        expect(entry.cacheControl).toEqual(ROUTE_CACHE_CONTROL);
    });

    it('같은 pathname이라도 다른 소스 라우트의 엔트리는 읽지 않는다', async () => {
        await newIncrementalCache().set('/AAPL', PAGE_VALUE, {
            cacheControl: ROUTE_CACHE_CONTROL,
            route: SYMBOL_OWNER,
        });
        expect(await drainUploads(1_000)).toBe(0);

        expect(
            await newIncrementalCache().get('/AAPL', {
                kind: 'APP_PAGE',
                isFallback: false,
                route: { kind: 'APP_PAGE', sourceRoute: '/[other]/page' },
            })
        ).toBeNull();
    });
});

describe('FETCH × 실제 IncrementalCache', () => {
    const KEY = 'fetch-key';
    const TAGS = ['news:AAPL'];

    async function seedFetch(revalidate) {
        const ic = newIncrementalCache();
        await ic.set(
            KEY,
            {
                kind: 'FETCH',
                data: { headers: {}, body: '"v1"', status: 200, url: '' },
                revalidate,
            },
            { fetchCache: true, tags: TAGS }
        );
        expect(await drainUploads(1_000)).toBe(0);
        await tick();
        return ic;
    }

    function read(ic, revalidate) {
        return ic.get(KEY, { kind: 'FETCH', revalidate, tags: TAGS });
    }

    it('fetch(revalidate: 600): stale 무효화 뒤 isStale === true이고 값이 남는다', async () => {
        const ic = await seedFetch(600);
        expect((await read(ic, 600)).isStale).toBe(false);

        await ic.revalidateTag(TAGS, MAX_DURATIONS);
        const entry = await read(ic, 600);
        expect(entry.isStale).toBe(true);
        expect(entry.value.data.body).toBe('"v1"');
    });

    it('unstable_cache(revalidate: false → 1년 저장)도 stale로 표현된다', async () => {
        // unstable-cache.js:28 — number가 아니면 CACHE_ONE_YEAR_SECONDS로 저장한다.
        const ic = await seedFetch(CACHE_ONE_YEAR_SECONDS);
        await ic.revalidateTag(TAGS, MAX_DURATIONS);
        expect((await read(ic, undefined)).isStale).toBe(true);
    });

    it('durations 없는 무효화는 miss', async () => {
        const ic = await seedFetch(600);
        await ic.revalidateTag(TAGS);
        expect(await read(ic, 600)).toBeNull();
    });
});
