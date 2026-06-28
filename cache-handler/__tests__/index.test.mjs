import { describe, it, expect, vi, beforeEach } from 'vitest';

const getEntry = vi.fn();
const setEntry = vi.fn();
vi.mock('../s3Store.mjs', () => ({
    getEntry: (...a) => getEntry(...a),
    setEntry: (...a) => setEntry(...a),
}));
vi.mock('../config.mjs', () => ({ config: { disabled: false } }));

import CacheHandler from '../index.mjs';
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

    it('비FETCH(APP_PAGE)는 data.kind로 pages에 라우팅한다', async () => {
        const before = Date.now();
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
