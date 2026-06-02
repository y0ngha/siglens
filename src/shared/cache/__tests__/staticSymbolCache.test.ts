import { describe, it, expect, vi, beforeEach } from 'vitest';

const unstableCacheSpy = vi.fn();
vi.mock('next/cache', () => ({
    // unstable_cache(fn, keyParts, opts) → returns a function that calls fn.
    unstable_cache: (fn: () => unknown, keyParts: string[], opts: unknown) => {
        unstableCacheSpy(keyParts, opts);
        return fn;
    },
}));

import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';

describe('staticSymbolCache', () => {
    beforeEach(() => unstableCacheSpy.mockClear());

    it('fetcher 결과를 반환하고 keyParts/revalidate/symbol 태그를 unstable_cache에 전달한다', async () => {
        const result = await staticSymbolCache(
            ['fundamental:profile', 'AAPL'],
            'AAPL',
            () => Promise.resolve({ ok: true })
        );
        expect(result).toEqual({ ok: true });
        expect(unstableCacheSpy).toHaveBeenCalledWith(
            ['fundamental:profile', 'AAPL'],
            { revalidate: 3600, tags: ['symbol:AAPL'] }
        );
    });

    it('extraTags를 symbol 태그 뒤에 덧붙인다(news:${symbol} 그룹 무효화용)', async () => {
        await staticSymbolCache(
            ['news:list', 'AAPL'],
            'AAPL',
            () => Promise.resolve([]),
            ['news:AAPL']
        );
        expect(unstableCacheSpy).toHaveBeenCalledWith(['news:list', 'AAPL'], {
            revalidate: 3600,
            tags: ['symbol:AAPL', 'news:AAPL'],
        });
    });
});
