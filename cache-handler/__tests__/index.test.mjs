import { describe, it, expect, vi, beforeEach } from 'vitest';

const getEntry = vi.fn();
const setEntry = vi.fn();
vi.mock('../s3Store.mjs', () => ({
    getEntry: (...a) => getEntry(...a),
    setEntry: (...a) => setEntry(...a),
}));
vi.mock('../config.mjs', () => ({ config: { disabled: false } }));

import CacheHandler, { collectTags } from '../index.mjs';
import { _resetForTest, markRevalidated } from '../tagStore.mjs';

beforeEach(() => {
    getEntry.mockReset();
    setEntry.mockReset();
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
