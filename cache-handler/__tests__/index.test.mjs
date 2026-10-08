import { vi } from 'vitest';

const {
    getEntry,
    setEntry,
    memGetEntry,
    memSetEntry,
    memDeleteEntry,
    mockConfig,
    isUpstashConfigured,
    zaddGreater,
    zrangeFromScore,
    zremBelowScore,
    serverTimeMs,
    expireKey,
    lookupStatus,
} = vi.hoisted(() => ({
    getEntry: vi.fn(),
    setEntry: vi.fn(),
    memGetEntry: vi.fn(),
    memSetEntry: vi.fn(() => true),
    memDeleteEntry: vi.fn(),
    mockConfig: { disabled: false },
    isUpstashConfigured: vi.fn(() => true),
    zaddGreater: vi.fn(async () => {}),
    zrangeFromScore: vi.fn(async () => ({ pairs: [], rawLength: 0 })),
    zremBelowScore: vi.fn(async () => {}),
    serverTimeMs: vi.fn(async () => Date.now()),
    expireKey: vi.fn(async () => {}),
    lookupStatus: { value: 'not-found' },
}));

// `getEntry` mock은 "S3에 있는 엔트리"를 돌려준다(없으면 null). 핸들러는
// `lookupEntry`의 status로 404와 오류를 가르므로, 상태가 필요한 테스트는
// `lookupStatus.value`로 miss 상태를 바꾼다.
vi.mock('../s3Store.mjs', () => ({
    lookupEntry: async (...a) => {
        const entry = await getEntry(...a);
        return entry
            ? { status: 'hit', entry }
            : { status: lookupStatus.value, entry: null };
    },
    setEntry: (...a) => setEntry(...a),
}));
// FETCH 엔트리는 S3가 아니라 프로세스 내 LRU로 간다(memStore.mjs). 두 저장소를
// 따로 mock해야 "FETCH가 S3를 건드리지 않는다"를 실제로 단언할 수 있다.
vi.mock('../memStore.mjs', () => ({
    getEntry: (...a) => memGetEntry(...a),
    setEntry: (...a) => memSetEntry(...a),
    deleteEntry: (...a) => memDeleteEntry(...a),
}));
// config.disabled를 테스트에서 토글할 수 있도록 mutable 객체로 mock.
// vi.mock 팩토리는 호이스트되므로 mutable 참조도 vi.hoisted로 끌어올려야 한다.
vi.mock('../config.mjs', () => ({ config: mockConfig }));
// Upstash를 반드시 mock한다. 이게 없으면 (a) UPSTASH_* env가 설정된 환경에서 유닛 테스트가
// 실제 Redis로 네트워크 I/O를 하고(.env.e2e는 실제로 이 키들을 설정한다), (b) env가 없는
// 환경에서는 isUpstashConfigured()가 false라 get()/revalidateTag()의 신규 통합 지점이
// 항상 조기 반환돼 커버리지가 100%로 보이면서도 실제로는 아무것도 검증하지 못한다.
vi.mock('../upstashRest.mjs', () => ({
    isUpstashConfigured,
    zaddGreater,
    zrangeFromScore,
    zremBelowScore,
    serverTimeMs,
    expireKey,
}));

import { createRequire } from 'node:module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CacheHandler, {
    collectTags,
    isImmediateExpiry,
    __resetForTests as resetHandler,
} from '../index.mjs';
import { _resetForTest, markRevalidated } from '../tagStore.mjs';
import { __resetForTests as resetPageMem } from '../pageMemStore.mjs';
import {
    drainUploads,
    pendingEntry,
    __resetForTests as resetUploads,
} from '../uploadQueue.mjs';

// 핸들러(nextInternals.mjs)가 쓰는 것과 같은 Next 정적 Map — 테스트마다 비운다.
// 16.3.8부터 인스턴스 `get`은 owner(소스 라우트)를 요구하므로 핸들러처럼 Map을 직접 본다.
const { SharedCacheControls } = createRequire(import.meta.url)(
    'next/dist/server/lib/incremental-cache/shared-cache-controls.external.js'
);
const sharedControls = SharedCacheControls.cacheControls;

// 'max' 프로필이 Next에서 핸들러로 넘어오는 모양(revalidation-utils.js:119-123).
const MAX_DURATIONS = { expire: 31536000 };
const PAGE_CACHE_CONTROL = { revalidate: 3600, expire: 31536000 };
const EXPIRED = tag => `\u0000expired:${tag}`;

/** 백그라운드 업로드가 끝날 때까지 기다린다(set은 S3 PUT을 기다리지 않는다). */
async function settleUploads() {
    expect(await drainUploads(1_000)).toBe(0);
}

// 무효화 시각은 현실적인 epoch ms여야 한다. 태그 스토어는 sync마다 보존 기간(7d)이 지난
// 엔트리를 정리하므로, 1000·2000 같은 1970년대 값을 쓰면 병합 직후 정리돼 테스트가 무너진다.
const NOW = Date.now();

/** 수동으로 resolve할 수 있는 promise — 비동기 순서를 단언하는 데 쓴다. */
function deferred() {
    let resolve;
    const promise = new Promise(r => {
        resolve = r;
    });
    return { promise, resolve };
}

beforeEach(() => {
    getEntry.mockReset();
    setEntry.mockReset();
    memGetEntry.mockReset();
    memSetEntry.mockReset();
    memSetEntry.mockReturnValue(true);
    memDeleteEntry.mockReset();
    mockConfig.disabled = false;
    mockConfig.buildPhase = false;
    isUpstashConfigured.mockReturnValue(true);
    zaddGreater.mockReset().mockResolvedValue(undefined);
    zrangeFromScore.mockReset().mockResolvedValue({ pairs: [], rawLength: 0 });
    zremBelowScore.mockReset().mockResolvedValue(undefined);
    serverTimeMs.mockReset().mockResolvedValue(NOW);
    expireKey.mockReset().mockResolvedValue(undefined);
    lookupStatus.value = 'not-found';
    _resetForTest();
    resetHandler();
    resetPageMem();
    resetUploads();
    sharedControls.clear();
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('CacheHandler.get', () => {
    it('miss면 null', async () => {
        getEntry.mockResolvedValueOnce(null);
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
    });

    it('태그가 revalidate되지 않았으면 wrapper { lastModified, value } 반환(hit)', async () => {
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: 1000,
            tags: ['news:AAPL'],
        });
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toEqual({ lastModified: 1000, value: { html: 'hi' } });
    });

    it('태그가 lastModified 이후 즉시 만료됐으면 null(블로킹 재생성)', async () => {
        markRevalidated('news:AAPL', NOW - 1000, { expired: true });
        getEntry.mockResolvedValueOnce({
            value: { html: 'old' },
            lastModified: NOW - 2000,
            tags: ['news:AAPL'],
        });
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
    });

    it('킬스위치(config.disabled)면 getEntry를 부르지 않고 null', async () => {
        mockConfig.disabled = true;
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
        expect(getEntry).not.toHaveBeenCalled();
    });

    it('엔트리에 tags가 없어도 throw하지 않고 hit 반환(entry.tags || [] fallback)', async () => {
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: 1000,
        });
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toEqual({ lastModified: 1000, value: { html: 'hi' } });
    });

    it('비FETCH는 ctx.kind를 그대로 S3 lookupEntry로 전달한다', async () => {
        getEntry.mockResolvedValueOnce(null);
        await new CacheHandler({}).get('/x', { kind: 'APP_PAGE' });
        expect(getEntry).toHaveBeenCalledWith('/x', 'APP_PAGE');
        expect(memGetEntry).not.toHaveBeenCalled();
    });

    it('FETCH는 메모리를 먼저 보고, 히트면 S3를 건너뛴다', async () => {
        memGetEntry.mockReturnValueOnce({
            lastModified: NOW,
            value: { kind: 'FETCH', data: {} },
            tags: [],
        });
        await new CacheHandler({}).get('/x', { kind: 'FETCH' });
        expect(memGetEntry).toHaveBeenCalledWith('/x');
        expect(getEntry).not.toHaveBeenCalled();
    });

    it('FETCH가 메모리에 없으면 S3로 폴백한다', async () => {
        // 크기 게이트를 넘어 S3로 간 엔트리(큰 unstable_cache/bars-static)를 위한 경로.
        memGetEntry.mockReturnValueOnce(null);
        getEntry.mockResolvedValueOnce(null);
        await new CacheHandler({}).get('/x', { kind: 'FETCH' });
        expect(getEntry).toHaveBeenCalledWith('/x', 'FETCH');
    });

    it('메모리 스토어 히트도 태그 무효화 판정을 거친다', async () => {
        // 저장소가 S3든 메모리든 무효화는 동일하게 적용돼야 한다 —
        // 이게 깨지면 revalidateTag 후에도 낡은 FETCH가 계속 fresh로 서빙된다.
        markRevalidated('fmp:AAPL', NOW - 1000, { expired: true });
        memGetEntry.mockReturnValueOnce({
            lastModified: NOW - 2000,
            value: { kind: 'FETCH', data: {} },
            tags: ['fmp:AAPL'],
        });
        expect(
            await new CacheHandler({}).get('/x', { kind: 'FETCH' })
        ).toBeNull();
    });
});

describe('CacheHandler.set', () => {
    it('작은 FETCH는 S3를 건드리지 않고 메모리에 쓴다', async () => {
        memSetEntry.mockReturnValueOnce(true);
        await new CacheHandler({}).set(
            '/api',
            { kind: 'FETCH', data: {} },
            { tags: ['t'] }
        );
        expect(setEntry).not.toHaveBeenCalled();
        const [key, entry] = memSetEntry.mock.calls[0];
        expect(key).toBe('/api');
        expect(entry.value).toEqual({ kind: 'FETCH', data: {} });
        expect(entry.tags).toEqual(['t']);
    });

    it('메모리가 거부한 큰 FETCH는 S3로 가고 메모리 사본이 정리된다', async () => {
        // 정리하지 않으면 같은 키가 커졌을 때 get이 낡은 메모리 사본을 먼저 집는다.
        memSetEntry.mockReturnValueOnce(false);
        await new CacheHandler({}).set(
            '/api',
            { kind: 'FETCH', data: {} },
            { tags: ['t'] }
        );
        await settleUploads();
        expect(memDeleteEntry).toHaveBeenCalledWith('/api');
        const [key, kind] = setEntry.mock.calls[0];
        expect(key).toBe('/api');
        expect(kind).toBe('FETCH');
    });

    it('FETCH는 ctx.tags + ctx.softTags + 값 tags를 모두 캡처한다', async () => {
        await new CacheHandler({}).set(
            '/api',
            { kind: 'FETCH', data: {}, tags: ['value:tag'] },
            { tags: ['ctx:tag'], softTags: ['soft:tag'] }
        );
        const [, entry] = memSetEntry.mock.calls[0];
        expect([...entry.tags].sort()).toEqual([
            'ctx:tag',
            'soft:tag',
            'value:tag',
        ]);
    });

    it('비FETCH(APP_PAGE)는 data.kind로 pages에 라우팅한다', async () => {
        const before = Date.now();
        // 주의: 실제 Next 16.2 APP_PAGE set context엔 tags 필드가 없다.
        // 이 케이스는 라우팅/lastModified만 검증하므로 ctx.tags를 임시로 둔다.
        await new CacheHandler({}).set(
            '/AAPL',
            { kind: 'APP_PAGE', html: 'x' },
            { tags: ['news:AAPL'] }
        );
        await settleUploads();
        const [, kind, entry] = setEntry.mock.calls[0];
        expect(kind).toBe('APP_PAGE');
        expect(entry.tags).toEqual(['news:AAPL']);
        expect(entry.lastModified).toBeGreaterThanOrEqual(before);
    });

    it('킬스위치(config.disabled)면 setEntry를 부르지 않는다', async () => {
        mockConfig.disabled = true;
        await new CacheHandler({}).set(
            '/AAPL',
            { kind: 'APP_PAGE', html: 'x' },
            {}
        );
        expect(setEntry).not.toHaveBeenCalled();
    });

    it('data가 null이면 setEntry를 부르지 않는다(Next 계약: !data → return)', async () => {
        await new CacheHandler({}).set('/AAPL', null, {});
        expect(setEntry).not.toHaveBeenCalled();
    });

    it('html이 빈 APP_PAGE는 저장하지 않는다(#657 빈 ISR 캐시 동결 방지)', async () => {
        await new CacheHandler({}).set(
            '/AAPL',
            { kind: 'APP_PAGE', html: '' },
            {}
        );
        expect(setEntry).not.toHaveBeenCalled();
    });

    it('html이 빈 PAGES도 저장하지 않는다', async () => {
        await new CacheHandler({}).set(
            '/AAPL',
            { kind: 'PAGES', html: undefined },
            {}
        );
        expect(setEntry).not.toHaveBeenCalled();
    });

    it('status가 4xx인 APP_PAGE는 html이 있어도 저장하지 않는다(notFound 404 영속 방지)', async () => {
        await new CacheHandler({}).set(
            '/AAPL',
            { kind: 'APP_PAGE', html: '<p>not found</p>', status: 404 },
            {}
        );
        expect(setEntry).not.toHaveBeenCalled();
    });

    it('status가 200인 APP_PAGE는 정상 저장한다', async () => {
        await new CacheHandler({}).set(
            '/AAPL',
            { kind: 'APP_PAGE', html: 'x', status: 200 },
            {}
        );
        await settleUploads();
        expect(setEntry).toHaveBeenCalledOnce();
    });

    it('status가 5xx인 APP_ROUTE는 body가 있어도 저장하지 않는다(빈/실패 응답 동결 방지)', async () => {
        await new CacheHandler({}).set(
            '/og',
            { kind: 'APP_ROUTE', body: Buffer.from('err'), status: 500 },
            {}
        );
        expect(setEntry).not.toHaveBeenCalled();
    });

    it('body가 빈 APP_ROUTE는 저장하지 않는다', async () => {
        await new CacheHandler({}).set(
            '/og',
            { kind: 'APP_ROUTE', body: null, status: 200 },
            {}
        );
        expect(setEntry).not.toHaveBeenCalled();
    });

    it('status가 200이고 body가 있는 APP_ROUTE는 정상 저장한다', async () => {
        await new CacheHandler({}).set(
            '/og',
            { kind: 'APP_ROUTE', body: Buffer.from('png'), status: 200 },
            {}
        );
        await settleUploads();
        expect(setEntry).toHaveBeenCalledOnce();
    });

    it('APP_PAGE는 ctx.tags 없이 x-next-cache-tags 헤더에서 태그를 캡처한다', async () => {
        // Next 16.2 페이지 set: context에 tags가 없고 태그는 캐시 값의
        // headers['x-next-cache-tags']에 쉼표 구분으로 실린다.
        await new CacheHandler({}).set(
            '/AAPL',
            {
                kind: 'APP_PAGE',
                html: 'x',
                headers: {
                    'x-next-cache-tags': 'news:AAPL, symbol:AAPL ,,_N_T_/AAPL',
                },
            },
            { fetchCache: false } // 페이지 set context엔 tags 필드 없음
        );
        await settleUploads();
        const [, kind, entry] = setEntry.mock.calls[0];
        expect(kind).toBe('APP_PAGE');
        // 쉼표 split + trim + 빈 항목 제거.
        expect([...entry.tags].sort()).toEqual([
            '_N_T_/AAPL',
            'news:AAPL',
            'symbol:AAPL',
        ]);
    });
});

describe('collectTags', () => {
    it('소스 전반에서 dedup하고 빈 항목을 제거한다', () => {
        const out = collectTags(
            {
                kind: 'APP_PAGE',
                headers: { 'x-next-cache-tags': 'a, b , a,' },
                tags: ['b', 'c'],
            },
            { tags: ['a'], softTags: ['d', ''] }
        );
        expect([...out].sort()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('태그 소스가 전혀 없으면 빈 배열', () => {
        expect(collectTags({ kind: 'APP_PAGE', html: 'x' }, {})).toEqual([]);
        expect(collectTags(undefined, undefined)).toEqual([]);
    });
});

describe('CacheHandler.resetRequestCache', () => {
    it('no-op으로 throw하지 않는다(로컬 태그맵은 per-request 상태가 아님)', () => {
        expect(() => new CacheHandler({}).resetRequestCache()).not.toThrow();
    });
});

describe('CacheHandler.revalidateTag', () => {
    it('string 인자를 처리한다(read-your-writes)', async () => {
        const h = new CacheHandler({});
        await h.revalidateTag('news:AAPL');
        getEntry.mockResolvedValue({
            value: 'v',
            lastModified: 0,
            tags: ['news:AAPL'],
        });
        expect(await h.get('/x', { kind: 'APP_PAGE' })).toBeNull(); // revalidatedAt > 0 > lastModified
    });

    it('string[] 인자를 처리한다(배열을 키로 쓰지 않는다)', async () => {
        const h = new CacheHandler({});
        await h.revalidateTag(['symbol:TSLA']);
        getEntry.mockResolvedValue({
            value: 'v',
            lastModified: 0,
            tags: ['symbol:TSLA'],
        });
        expect(await h.get('/x', { kind: 'APP_PAGE' })).toBeNull();
    });

    it('stale 무효화(durations 있음)를 원격 태그 로그에 정규화된 배열로 전파한다', async () => {
        await new CacheHandler({}).revalidateTag('news:AAPL', MAX_DURATIONS);
        expect(zaddGreater).toHaveBeenCalledTimes(1);
        const [key, entries] = zaddGreater.mock.calls[0];
        expect(key).toBe('siglens:isr:tags');
        expect(entries).toHaveLength(1);
        expect(entries[0][1]).toBe('news:AAPL');
        expect(typeof entries[0][0]).toBe('number');
    });

    it('즉시 만료 무효화(durations 없음)는 만료 멤버도 함께 전파한다', async () => {
        await new CacheHandler({}).revalidateTag('news:AAPL');
        const [, entries] = zaddGreater.mock.calls[0];
        expect(entries.map(([, member]) => member)).toEqual([
            'news:AAPL',
            EXPIRED('news:AAPL'),
        ]);
    });

    it('원격 기록이 실패해도 throw하지 않고 로컬 무효화는 유지된다', async () => {
        zaddGreater.mockRejectedValueOnce(new Error('upstash down'));
        const h = new CacheHandler({});
        await expect(h.revalidateTag('news:AAPL')).resolves.toBeUndefined();
        getEntry.mockResolvedValue({
            value: 'v',
            lastModified: 0,
            tags: ['news:AAPL'],
        });
        expect(await h.get('/x', { kind: 'APP_PAGE' })).toBeNull();
    });

    it('유효/무효 태그가 섞이면 유효한 태그만 원격 발행하고 로컬에도 그것만 기록한다', async () => {
        const h = new CacheHandler({});
        await h.revalidateTag(['', null, 'ok'], MAX_DURATIONS);

        // 원격에는 'ok'만 발행된다.
        expect(zaddGreater).toHaveBeenCalledTimes(1);
        const [key, entries] = zaddGreater.mock.calls[0];
        expect(key).toBe('siglens:isr:tags');
        expect(entries).toEqual([[expect.any(Number), 'ok']]);

        // ''는 로컬 맵에도 기록되지 않았으므로, ''로 태그된 엔트리는 무효화되지 않는다(hit 유지).
        getEntry.mockResolvedValueOnce({
            value: 'v',
            lastModified: 0,
            tags: [''],
        });
        expect(await h.get('/x', { kind: 'APP_PAGE' })).toEqual({
            lastModified: 0,
            value: 'v',
        });
    });

    it('revalidateTag([])는 원격 호출 없이 반환한다', async () => {
        await new CacheHandler({}).revalidateTag([]);
        expect(zaddGreater).not.toHaveBeenCalled();
    });

    it("revalidateTag('')는 원격 호출 없이 반환한다", async () => {
        await new CacheHandler({}).revalidateTag('');
        expect(zaddGreater).not.toHaveBeenCalled();
    });
});

// 이 describe가 이 변경의 존재 이유를 지킨다 — 다른 인스턴스가 기록한 무효화를
// 이 인스턴스의 get()이 실제로 반영하는지. get()에서 ensureTagsFresh() 호출을 지우거나
// maxRevalidatedAt 아래로 내리면 여기서 잡힌다.
describe('CacheHandler.get — 멀티 인스턴스 태그 전파', () => {
    it('다른 인스턴스가 즉시 만료한 엔트리를 miss로 판정한다', async () => {
        // 로컬 맵은 비어 있고, 원격 태그 로그에만 무효화 기록이 있는 상태.
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: NOW - 2000,
            tags: ['news:AAPL'],
            cacheControl: PAGE_CACHE_CONTROL,
        });
        zrangeFromScore.mockResolvedValueOnce({
            pairs: [
                ['news:AAPL', NOW - 1000],
                [EXPIRED('news:AAPL'), NOW - 1000],
            ],
            rawLength: 4,
        });

        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
    });

    it('다른 인스턴스의 stale 무효화는 엔트리를 stale로 서빙하게 한다', async () => {
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: NOW - 2000,
            tags: ['news:AAPL'],
            cacheControl: PAGE_CACHE_CONTROL,
        });
        zrangeFromScore.mockResolvedValueOnce({
            pairs: [['news:AAPL', NOW - 1000]],
            rawLength: 2,
        });

        const result = await new CacheHandler({}).get('/AAPL', {
            kind: 'APP_PAGE',
        });
        expect(result.value).toEqual({ html: 'hi' });
        expect(result.lastModified).toBeLessThan(Date.now() - 3600 * 1000);
    });

    it('원격 무효화가 엔트리보다 오래됐으면 hit을 유지한다', async () => {
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: NOW - 1000,
            tags: ['news:AAPL'],
        });
        zrangeFromScore.mockResolvedValueOnce({
            pairs: [['news:AAPL', NOW - 2000]],
            rawLength: 2,
        });

        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toEqual({ lastModified: NOW - 1000, value: { html: 'hi' } });
    });

    it('freshness 판정 전에 원격 병합을 기다린다(순서 보장)', async () => {
        const gate = deferred();
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: NOW - 2000,
            tags: ['news:AAPL'],
        });
        zrangeFromScore.mockReturnValueOnce(gate.promise);

        let settled = false;
        const pending = new CacheHandler({})
            .get('/AAPL', { kind: 'APP_PAGE' })
            .then(result => {
                settled = true;
                return result;
            });

        await Promise.resolve();
        expect(settled).toBe(false); // 아직 병합을 기다리는 중

        gate.resolve({
            pairs: [[EXPIRED('news:AAPL'), NOW - 1000]],
            rawLength: 2,
        });
        expect(await pending).toBeNull(); // 병합된 무효화가 판정에 반영됨
    });

    it('원격 조회가 실패해도 get은 정상 응답한다(fail-open)', async () => {
        zrangeFromScore.mockRejectedValueOnce(new Error('upstash down'));
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: NOW - 1000,
            tags: ['news:AAPL'],
        });

        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toEqual({ lastModified: NOW - 1000, value: { html: 'hi' } });
    });

    it('캐시 miss에서는 원격을 조회하지 않는다(무효화할 엔트리가 없음)', async () => {
        getEntry.mockResolvedValueOnce(null);
        await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' });
        expect(zrangeFromScore).not.toHaveBeenCalled();
    });

    it('Upstash 미설정이면 원격을 조회하지 않고 로컬 판정만 한다', async () => {
        isUpstashConfigured.mockReturnValue(false);
        markRevalidated('news:AAPL', 2000, { expired: true });
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: 1000,
            tags: ['news:AAPL'],
        });

        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
        expect(zrangeFromScore).not.toHaveBeenCalled();
    });
});

describe('isImmediateExpiry — Next FileSystemCache.revalidateTag와 같은 판정', () => {
    it('durations가 없으면 즉시 만료(updateTag·단일 인자 revalidateTag)', () => {
        expect(isImmediateExpiry(undefined)).toBe(true);
    });

    it("'max'(expire 1년)는 stale만 — SWR", () => {
        expect(isImmediateExpiry(MAX_DURATIONS)).toBe(false);
    });

    it('expire가 0 이하면 즉시 만료', () => {
        expect(isImmediateExpiry({ expire: 0 })).toBe(true);
        expect(isImmediateExpiry({ expire: -1 })).toBe(true);
    });

    it('expire가 없는 durations는 stale만', () => {
        expect(isImmediateExpiry({})).toBe(false);
    });
});

// 이 describe가 감사 F1(High)의 회귀를 막는다 — 'max' 무효화 직후 첫 요청이 miss(블로킹
// 렌더)가 되면 안 되고, Next가 stale로 판정할 lastModified와 함께 엔트리를 돌려줘야 한다.
describe('CacheHandler.get — stale(SWR) 무효화', () => {
    const PAGE = {
        value: { kind: 'APP_PAGE', html: 'old' },
        lastModified: NOW - 10_000,
        tags: ['seo-snapshot:AAPL'],
        cacheControl: PAGE_CACHE_CONTROL,
    };

    it("revalidateTag(tag, 'max') 뒤 페이지는 miss가 아니라 stale lastModified로 돌려준다", async () => {
        const h = new CacheHandler({});
        await h.revalidateTag('seo-snapshot:AAPL', MAX_DURATIONS);
        getEntry.mockResolvedValueOnce(PAGE);

        const before = Date.now();
        const result = await h.get('/AAPL', { kind: 'APP_PAGE' });
        const after = Date.now();

        expect(result.value).toBe(PAGE.value);
        // incremental-cache/index.js:441-451 — revalidate*1000 + lastModified < now 이면 stale.
        expect(result.lastModified + 3600 * 1000).toBeLessThan(before);
        // expire 경계(:446-448)는 넘지 않는다 — 넘으면 isStale=-1로 다시 블로킹이 된다.
        expect(result.lastModified + 31536000 * 1000).toBeGreaterThan(after);
    });

    it('무효화보다 새 엔트리는 원래 lastModified 그대로(fresh)', async () => {
        markRevalidated('seo-snapshot:AAPL', NOW - 20_000);
        getEntry.mockResolvedValueOnce(PAGE);
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toEqual({ lastModified: PAGE.lastModified, value: PAGE.value });
    });

    it('Next 공유 맵의 cacheControl이 엔트리 값보다 우선한다(Next가 실제로 쓰는 값)', async () => {
        sharedControls.set('/AAPL', { revalidate: 7200, expire: 31536000 });
        markRevalidated('seo-snapshot:AAPL', NOW - 1_000);
        getEntry.mockResolvedValueOnce(PAGE);

        const before = Date.now();
        const result = await new CacheHandler({}).get('/AAPL', {
            kind: 'APP_PAGE',
        });
        expect(result.lastModified + 7200 * 1000).toBeLessThan(before);
    });

    it('revalidate:false 라우트는 시간으로 stale을 표현할 수 없어 miss다', async () => {
        markRevalidated('seo-snapshot:AAPL', NOW - 1_000);
        getEntry.mockResolvedValueOnce({
            ...PAGE,
            cacheControl: { revalidate: false, expire: undefined },
        });
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
    });

    it('expire가 revalidate와 같아 stale 창이 없으면 miss다', async () => {
        markRevalidated('seo-snapshot:AAPL', NOW - 1_000);
        getEntry.mockResolvedValueOnce({
            ...PAGE,
            cacheControl: { revalidate: 60, expire: 60 },
        });
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
    });

    it('cacheControl을 어디서도 알 수 없으면(옛 엔트리) 예전처럼 miss다', async () => {
        markRevalidated('seo-snapshot:AAPL', NOW - 1_000);
        const legacy = { ...PAGE };
        delete legacy.cacheControl;
        getEntry.mockResolvedValueOnce(legacy);
        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
    });

    it('FETCH는 ctx.revalidate 기준으로 stale lastModified를 돌려준다(index.js:406-408)', async () => {
        markRevalidated('news:AAPL', NOW - 1_000);
        memGetEntry.mockReturnValueOnce({
            value: { kind: 'FETCH', data: {}, revalidate: 43200 },
            lastModified: NOW - 5_000,
            tags: ['news:AAPL'],
        });
        const before = Date.now();
        const result = await new CacheHandler({}).get('k', {
            kind: 'FETCH',
            revalidate: 600,
        });
        expect(result.value.kind).toBe('FETCH');
        expect(result.lastModified + 600 * 1000).toBeLessThan(before);
    });

    it('FETCH에 ctx.revalidate가 없으면 값의 revalidate를 쓴다', async () => {
        markRevalidated('news:AAPL', NOW - 1_000);
        memGetEntry.mockReturnValueOnce({
            value: { kind: 'FETCH', data: {}, revalidate: 43200 },
            lastModified: NOW - 5_000,
            tags: ['news:AAPL'],
        });
        const before = Date.now();
        const result = await new CacheHandler({}).get('k', { kind: 'FETCH' });
        expect(result.lastModified + 43200 * 1000).toBeLessThan(before);
    });

    it('FETCH에 revalidate가 전혀 없으면 miss다', async () => {
        markRevalidated('news:AAPL', NOW - 1_000);
        memGetEntry.mockReturnValueOnce({
            value: { kind: 'FETCH', data: {} },
            lastModified: NOW - 5_000,
            tags: ['news:AAPL'],
        });
        expect(
            await new CacheHandler({}).get('k', { kind: 'FETCH' })
        ).toBeNull();
    });

    it('stale 판정은 저장된 엔트리를 바꾸지 않는다(메모리 계층 공유 객체)', async () => {
        markRevalidated('seo-snapshot:AAPL', NOW - 1_000);
        const entry = { ...PAGE };
        getEntry.mockResolvedValueOnce(entry);
        await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' });
        expect(entry.lastModified).toBe(PAGE.lastModified);
    });
});

// 감사 F5 — 재시작 직후 on-demand ISR 라우트가 STALE + Cache-Control 없음으로 나가던 문제.
describe('라우트 cacheControl 영속·재시드', () => {
    it('set은 ctx.cacheControl을 엔트리에 영속한다', async () => {
        await new CacheHandler({}).set(
            '/AAPL',
            { kind: 'APP_PAGE', html: 'x' },
            { cacheControl: { revalidate: 3600, expire: 31536000 } }
        );
        await settleUploads();
        const [, , entry] = setEntry.mock.calls[0];
        expect(entry.cacheControl).toEqual({
            revalidate: 3600,
            expire: 31536000,
        });
    });

    it('FETCH는 cacheControl을 영속하지 않는다(라우트 개념이 없다)', async () => {
        await new CacheHandler({}).set(
            'k',
            { kind: 'FETCH', data: {} },
            { cacheControl: { revalidate: 1 } }
        );
        expect(memSetEntry.mock.calls[0][1].cacheControl).toBeUndefined();
    });

    it('get은 Next 공유 맵에 키가 없으면 받은 키 그대로 영속 값을 채운다', async () => {
        getEntry.mockResolvedValueOnce({
            value: { kind: 'APP_PAGE', html: 'x' },
            lastModified: NOW,
            tags: [],
            cacheControl: PAGE_CACHE_CONTROL,
        });
        // 16.3.8의 루트 페이지 키 모양. IncrementalCache는 핸들러에 넘긴 키 그대로 맵을 읽는다
        // (정규화하지 않는다 — nextInternals.mjs 상단 "라우트 cacheControl 맵의 키").
        const key = `/route-cache/APP_PAGE/${'a'.repeat(64)}/$/index`;
        await new CacheHandler({}).get(key, { kind: 'APP_PAGE' });
        expect(sharedControls.get(key)).toEqual(PAGE_CACHE_CONTROL);
    });

    it('이미 값이 있으면 덮어쓰지 않는다(이 프로세스가 더 최근에 쓴 값 우선)', async () => {
        const current = { revalidate: 30, expire: 31536000 };
        sharedControls.set('/AAPL', current);
        getEntry.mockResolvedValueOnce({
            value: { kind: 'APP_PAGE', html: 'x' },
            lastModified: NOW,
            tags: [],
            cacheControl: PAGE_CACHE_CONTROL,
        });
        await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' });
        expect(sharedControls.get('/AAPL')).toBe(current);
    });

    it('형식이 틀린 cacheControl은 시드하지 않는다', async () => {
        getEntry.mockResolvedValueOnce({
            value: { kind: 'APP_PAGE', html: 'x' },
            lastModified: NOW,
            tags: [],
            cacheControl: { revalidate: 'soon' },
        });
        await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' });
        expect(sharedControls.get('/AAPL')).toBeUndefined();
    });
});

// 감사 F2 — miss 응답이 S3 PUT을 기다리지 않는다.
describe('CacheHandler.set — 백그라운드 업로드', () => {
    function deferredPut() {
        const gate = deferred();
        setEntry.mockImplementation(() => gate.promise);
        return gate;
    }

    it('페이지 set은 S3 PUT이 끝나기 전에 resolve된다', async () => {
        const gate = deferredPut();
        await new CacheHandler({}).set(
            '/AAPL',
            { kind: 'APP_PAGE', html: 'x' },
            {}
        );
        // 여기 도달했다 = PUT(gate)이 아직 끝나지 않았는데 set이 resolve됐다.
        await Promise.resolve();
        expect(setEntry).toHaveBeenCalledOnce();
        gate.resolve();
        await settleUploads();
    });

    it('큰 FETCH도 업로드 중에 같은 인스턴스의 get이 값을 본다(read-your-writes)', async () => {
        const gate = deferredPut();
        memSetEntry.mockReturnValueOnce(false); // 메모리 게이트 초과 → S3 경로
        const h = new CacheHandler({});
        await h.set('big', { kind: 'FETCH', data: { body: 'x' } }, {});

        const result = await h.get('big', { kind: 'FETCH' });
        expect(result.value).toEqual({ kind: 'FETCH', data: { body: 'x' } });
        expect(getEntry).not.toHaveBeenCalled(); // S3 GET 없이 대기 사본에서

        gate.resolve();
        await settleUploads();
        expect(pendingEntry('big', 'FETCH')).toBeNull();
    });

    it('같은 키의 연속 set은 순서대로 올리고, 대기 중 밀린 중간 값은 건너뛴다', async () => {
        const gate = deferredPut();
        const h = new CacheHandler({});
        await h.set('/AAPL', { kind: 'APP_PAGE', html: 'v1' }, {});
        await Promise.resolve();
        await h.set('/AAPL', { kind: 'APP_PAGE', html: 'v2' }, {});
        await h.set('/AAPL', { kind: 'APP_PAGE', html: 'v3' }, {});
        expect(setEntry).toHaveBeenCalledTimes(1); // v1 진행 중, 나머지는 대기

        setEntry.mockResolvedValue(undefined);
        gate.resolve();
        await settleUploads();
        expect(setEntry.mock.calls.map(([, , e]) => e.value.html)).toEqual([
            'v1',
            'v3',
        ]);
    });

    it('업로드가 reject해도 set은 throw하지 않고 같은 키의 다음 업로드도 진행된다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        setEntry.mockRejectedValueOnce(new Error('boom'));
        const h = new CacheHandler({});
        await expect(
            h.set('/AAPL', { kind: 'APP_PAGE', html: 'v1' }, {})
        ).resolves.toBeUndefined();
        await settleUploads();
        await h.set('/AAPL', { kind: 'APP_PAGE', html: 'v2' }, {});
        await settleUploads();
        expect(setEntry).toHaveBeenCalledTimes(2);
        errorSpy.mockRestore();
    });

    it('빌드 단계의 페이지 set은 메모리·업로드를 모두 건너뛴다', async () => {
        mockConfig.buildPhase = true;
        const h = new CacheHandler({});
        await h.set('/AAPL', { kind: 'APP_PAGE', html: 'x' }, {});
        await settleUploads();
        expect(setEntry).not.toHaveBeenCalled();
        getEntry.mockResolvedValueOnce(null);
        expect(await h.get('/AAPL', { kind: 'APP_PAGE' })).toBeNull();
    });
});

// 감사 F3 — 페이지 엔트리의 프로세스 내 L1.
describe('CacheHandler — 페이지 메모리 계층', () => {
    it('S3에서 읽은 페이지는 다음 get부터 메모리에서 나온다', async () => {
        getEntry.mockResolvedValueOnce({
            value: { kind: 'APP_PAGE', html: 'x' },
            lastModified: NOW,
            tags: [],
        });
        const h = new CacheHandler({});
        await h.get('/AAPL', { kind: 'APP_PAGE' });
        const second = await h.get('/AAPL', { kind: 'APP_PAGE' });
        expect(second.value.html).toBe('x');
        expect(getEntry).toHaveBeenCalledTimes(1);
    });

    it('set 직후 get은 S3 없이 새 값을 본다', async () => {
        setEntry.mockResolvedValue(undefined);
        const h = new CacheHandler({});
        await h.set('/AAPL', { kind: 'APP_PAGE', html: 'new' }, {});
        await settleUploads();
        const result = await h.get('/AAPL', { kind: 'APP_PAGE' });
        expect(result.value.html).toBe('new');
        expect(getEntry).not.toHaveBeenCalled();
    });

    it('메모리 히트도 태그 판정을 거친다', async () => {
        setEntry.mockResolvedValue(undefined);
        const h = new CacheHandler({});
        await h.set(
            '/AAPL',
            {
                kind: 'APP_PAGE',
                html: 'x',
                headers: { 'x-next-cache-tags': 'news:AAPL' },
            },
            {}
        );
        await settleUploads();
        // 같은 밀리초에 무효화하면 `>` 판정이 거짓이 된다 — 시각을 확실히 넘긴다.
        await new Promise(resolve => setTimeout(resolve, 2));
        await h.revalidateTag('news:AAPL');
        expect(await h.get('/AAPL', { kind: 'APP_PAGE' })).toBeNull();
    });

    it('킬 스위치(ISR_PAGE_CACHE_DISABLED)면 매번 S3로 간다', async () => {
        vi.stubEnv('ISR_PAGE_CACHE_DISABLED', 'true');
        getEntry.mockResolvedValue({
            value: { kind: 'APP_PAGE', html: 'x' },
            lastModified: NOW,
            tags: [],
        });
        const h = new CacheHandler({});
        await h.get('/AAPL', { kind: 'APP_PAGE' });
        await h.get('/AAPL', { kind: 'APP_PAGE' });
        expect(getEntry).toHaveBeenCalledTimes(2);
    });
});

// 감사 F4 — S3에 쓰인 적 없는 작은 FETCH 키의 반복 GET.
describe('CacheHandler.get — FETCH 404 네거티브 캐시', () => {
    it('404를 기억해 같은 키의 다음 miss는 S3를 다시 부르지 않는다', async () => {
        getEntry.mockResolvedValue(null);
        const h = new CacheHandler({});
        expect(await h.get('k', { kind: 'FETCH' })).toBeNull();
        expect(await h.get('k', { kind: 'FETCH' })).toBeNull();
        expect(getEntry).toHaveBeenCalledTimes(1);
    });

    it('set이 오면 기억을 지운다', async () => {
        getEntry.mockResolvedValue(null);
        const h = new CacheHandler({});
        await h.get('k', { kind: 'FETCH' });
        memSetEntry.mockReturnValueOnce(false); // S3 경로
        setEntry.mockResolvedValue(undefined);
        await h.set('k', { kind: 'FETCH', data: {} }, {});
        await settleUploads();
        await h.get('k', { kind: 'FETCH' });
        expect(getEntry).toHaveBeenCalledTimes(2);
    });

    it('404가 아닌 실패(타임아웃 등)는 기억하지 않는다', async () => {
        lookupStatus.value = 'error';
        getEntry.mockResolvedValue(null);
        const h = new CacheHandler({});
        await h.get('k', { kind: 'FETCH' });
        await h.get('k', { kind: 'FETCH' });
        expect(getEntry).toHaveBeenCalledTimes(2);
    });

    it('GET이 날아가는 사이 S3 쓰기가 있었으면 그 404는 기억하지 않는다', async () => {
        const gate = deferred();
        getEntry.mockReturnValueOnce(gate.promise);
        const h = new CacheHandler({});
        const inflight = h.get('k', { kind: 'FETCH' });

        memSetEntry.mockReturnValueOnce(false);
        setEntry.mockResolvedValue(undefined);
        await h.set('k', { kind: 'FETCH', data: {} }, {});
        await settleUploads();
        gate.resolve(null); // 쓰기 이전에 시작된 GET의 낡은 404
        await inflight;

        getEntry.mockResolvedValueOnce(null);
        await h.get('k', { kind: 'FETCH' });
        expect(getEntry).toHaveBeenCalledTimes(2);
    });

    it('페이지 miss는 네거티브 캐시를 쓰지 않는다', async () => {
        getEntry.mockResolvedValue(null);
        const h = new CacheHandler({});
        await h.get('/AAPL', { kind: 'APP_PAGE' });
        await h.get('/AAPL', { kind: 'APP_PAGE' });
        expect(getEntry).toHaveBeenCalledTimes(2);
    });
});

// 리뷰 R1 required — 늦게 도착한 S3 GET의 옛 객체가 방금 set한 새 페이지를 L1에서 덮어쓰면 안 된다.
describe('CacheHandler.get — 페이지 GET과 set의 경쟁', () => {
    const OLD = {
        value: { kind: 'APP_PAGE', html: 'old' },
        lastModified: NOW - 60_000,
        tags: [],
    };

    it('GET이 날아가는 사이 set이 오면 새 값을 돌려주고 옛 객체를 메모리에 넣지 않는다', async () => {
        const gate = deferred();
        getEntry.mockReturnValueOnce(gate.promise);
        setEntry.mockResolvedValue(undefined);
        const h = new CacheHandler({});

        const inflight = h.get('/AAPL', { kind: 'APP_PAGE' });
        await h.set('/AAPL', { kind: 'APP_PAGE', html: 'new' }, {});
        gate.resolve(OLD);

        expect((await inflight).value.html).toBe('new');
        await settleUploads();
        const next = await h.get('/AAPL', { kind: 'APP_PAGE' });
        expect(next.value.html).toBe('new');
        expect(getEntry).toHaveBeenCalledTimes(1);
    });

    it('경쟁한 set이 메모리에 안 남았으면(킬 스위치) 대기 사본, 그것도 없으면 GET 결과를 쓴다', async () => {
        vi.stubEnv('ISR_PAGE_CACHE_DISABLED', 'true');
        const gate = deferred();
        getEntry.mockReturnValueOnce(gate.promise);
        const put = deferred();
        setEntry.mockReturnValueOnce(put.promise);
        const h = new CacheHandler({});

        const first = h.get('/AAPL', { kind: 'APP_PAGE' });
        await h.set('/AAPL', { kind: 'APP_PAGE', html: 'new' }, {});
        gate.resolve(OLD);
        expect((await first).value.html).toBe('new'); // 업로드 대기 사본
        put.resolve();
        await settleUploads();

        const gate2 = deferred();
        getEntry.mockReturnValueOnce(gate2.promise);
        const second = h.get('/MSFT', { kind: 'APP_PAGE' });
        setEntry.mockResolvedValue(undefined);
        await h.set('/OTHER', { kind: 'APP_PAGE', html: 'x' }, {});
        await settleUploads();
        gate2.resolve(OLD);
        expect((await second).value.html).toBe('old');
    });

    it('경쟁이 없으면 S3에서 읽은 값을 메모리에 넣는다', async () => {
        getEntry.mockResolvedValueOnce(OLD);
        const h = new CacheHandler({});
        await h.get('/AAPL', { kind: 'APP_PAGE' });
        await h.get('/AAPL', { kind: 'APP_PAGE' });
        expect(getEntry).toHaveBeenCalledTimes(1);
    });
});

describe('CacheHandler.get — stale 처리는 엔트리를 더 새롭게 만들지 않는다', () => {
    it('이미 시간상 stale인 페이지는 원래 lastModified로 돌려준다', async () => {
        markRevalidated('news:AAPL', NOW - 1_000);
        const old = NOW - 2 * 3600 * 1000;
        getEntry.mockResolvedValueOnce({
            value: { kind: 'APP_PAGE', html: 'x' },
            lastModified: old,
            tags: ['news:AAPL'],
            cacheControl: PAGE_CACHE_CONTROL,
        });
        // 무효화(NOW-1s)가 엔트리보다 새로워야 stale 분기로 간다 — old < NOW-1s.
        const result = await new CacheHandler({}).get('/AAPL', {
            kind: 'APP_PAGE',
        });
        expect(result.lastModified).toBe(old);
    });
});
