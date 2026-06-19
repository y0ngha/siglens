// spy → vi.mock → imports 순서 (MISTAKES.md Tests §17: vi.mock을 import 사이에 끼우지
// 않고, 팩토리가 참조하는 spy는 vi.hoisted로 끌어올린다).
const unstableCacheSpy = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({
    // unstable_cache(fn, keyParts, opts) → returns a function that calls fn.
    unstable_cache: (fn: () => unknown, keyParts: string[], opts: unknown) => {
        unstableCacheSpy(keyParts, opts);
        return fn;
    },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SECONDS_PER_HOUR, SECONDS_PER_DAY } from '@/shared/config/time';
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
            { revalidate: SECONDS_PER_HOUR, tags: ['symbol:AAPL'] }
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
            revalidate: SECONDS_PER_HOUR,
            tags: ['symbol:AAPL', 'news:AAPL'],
        });
    });

    it('revalidateSeconds를 명시하면 기본 1h 대신 전달한 값으로 revalidate한다', async () => {
        await staticSymbolCache(
            ['financials:income', 'AAPL', 'annual'],
            'AAPL',
            () => Promise.resolve([]),
            [],
            SECONDS_PER_DAY
        );
        expect(unstableCacheSpy).toHaveBeenCalledWith(
            ['financials:income', 'AAPL', 'annual'],
            { revalidate: SECONDS_PER_DAY, tags: ['symbol:AAPL'] }
        );
    });
});
