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
}));

vi.mock('../s3Store.mjs', () => ({
    getEntry: (...a) => getEntry(...a),
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

import { describe, it, expect, beforeEach } from 'vitest';
import CacheHandler, { collectTags } from '../index.mjs';
import { _resetForTest, markRevalidated } from '../tagStore.mjs';

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
    isUpstashConfigured.mockReturnValue(true);
    zaddGreater.mockReset().mockResolvedValue(undefined);
    zrangeFromScore.mockReset().mockResolvedValue({ pairs: [], rawLength: 0 });
    zremBelowScore.mockReset().mockResolvedValue(undefined);
    serverTimeMs.mockReset().mockResolvedValue(NOW);
    expireKey.mockReset().mockResolvedValue(undefined);
    _resetForTest();
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

    it('태그가 lastModified 이후 revalidate됐으면 null(stale)', async () => {
        markRevalidated('news:AAPL', NOW - 1000);
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

    it('비FETCH는 ctx.kind를 그대로 S3 getEntry로 전달한다', async () => {
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
        // 저장소가 S3든 메모리든 soft invalidation은 동일하게 적용돼야 한다 —
        // 이게 깨지면 revalidateTag 후에도 stale FETCH가 계속 서빙된다.
        markRevalidated('fmp:AAPL', NOW - 1000);
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

    it('무효화를 원격 태그 로그에 정규화된 배열로 전파한다', async () => {
        await new CacheHandler({}).revalidateTag('news:AAPL');
        expect(zaddGreater).toHaveBeenCalledTimes(1);
        const [key, entries] = zaddGreater.mock.calls[0];
        expect(key).toBe('siglens:isr:tags');
        expect(entries).toHaveLength(1);
        expect(entries[0][1]).toBe('news:AAPL');
        expect(typeof entries[0][0]).toBe('number');
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
        await h.revalidateTag(['', null, 'ok']);

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
    it('다른 인스턴스가 무효화한 엔트리를 stale로 판정한다', async () => {
        // 로컬 맵은 비어 있고, 원격 태그 로그에만 무효화 기록이 있는 상태.
        getEntry.mockResolvedValueOnce({
            value: { html: 'hi' },
            lastModified: NOW - 2000,
            tags: ['news:AAPL'],
        });
        zrangeFromScore.mockResolvedValueOnce({
            pairs: [['news:AAPL', NOW - 1000]],
            rawLength: 2,
        });

        expect(
            await new CacheHandler({}).get('/AAPL', { kind: 'APP_PAGE' })
        ).toBeNull();
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

        gate.resolve({ pairs: [['news:AAPL', NOW - 1000]], rawLength: 2 });
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
        markRevalidated('news:AAPL', 2000);
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
