import { describe, it, expect, vi, beforeEach } from 'vitest';

const getEntry = vi.fn();
const setEntry = vi.fn();
vi.mock('../s3Store.mjs', () => ({
    getEntry: (...a) => getEntry(...a),
    setEntry: (...a) => setEntry(...a),
}));
// config.disabled를 테스트에서 토글할 수 있도록 mutable 객체로 mock.
// vi.mock 팩토리는 호이스트되므로 mutable 참조도 vi.hoisted로 끌어올려야 한다.
const { mockConfig } = vi.hoisted(() => ({ mockConfig: { disabled: false } }));
vi.mock('../config.mjs', () => ({ config: mockConfig }));

import CacheHandler, { collectTags } from '../index.mjs';
import { _resetForTest, markRevalidated } from '../tagStore.mjs';

beforeEach(() => {
    getEntry.mockReset();
    setEntry.mockReset();
    mockConfig.disabled = false;
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
        markRevalidated('news:AAPL', 2000);
        getEntry.mockResolvedValueOnce({
            value: { html: 'old' },
            lastModified: 1000,
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

    it('ctx.kind를 getEntry로 그대로 전달한다(fetch/pages 라우팅)', async () => {
        getEntry.mockResolvedValueOnce(null);
        await new CacheHandler({}).get('/x', { kind: 'FETCH' });
        expect(getEntry).toHaveBeenCalledWith('/x', 'FETCH');
    });
});

describe('CacheHandler.set', () => {
    it('FETCH는 data.kind로 fetch subfolder에 라우팅한다', async () => {
        await new CacheHandler({}).set(
            '/api',
            { kind: 'FETCH', data: {} },
            { tags: ['t'] }
        );
        const [key, kind, entry] = setEntry.mock.calls[0];
        expect(key).toBe('/api');
        expect(kind).toBe('FETCH');
        expect(entry.value).toEqual({ kind: 'FETCH', data: {} });
        expect(entry.tags).toEqual(['t']);
    });

    it('FETCH는 ctx.tags + ctx.softTags + 값 tags를 모두 캡처한다', async () => {
        await new CacheHandler({}).set(
            '/api',
            { kind: 'FETCH', data: {}, tags: ['value:tag'] },
            { tags: ['ctx:tag'], softTags: ['soft:tag'] }
        );
        const [, , entry] = setEntry.mock.calls[0];
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
    it('string과 string[] 모두 처리한다(read-your-writes)', async () => {
        const h = new CacheHandler({});
        await h.revalidateTag('news:AAPL');
        await h.revalidateTag(['symbol:TSLA']);
        getEntry.mockResolvedValue({
            value: 'v',
            lastModified: 0,
            tags: ['news:AAPL'],
        });
        expect(await h.get('/x', { kind: 'APP_PAGE' })).toBeNull(); // revalidatedAt > 0 > lastModified
    });
});
