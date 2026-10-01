vi.mock('@/shared/cache/staticSymbolCache', () => ({
    // unstable_cache의 계약을 흉내 낸다 — fetcher가 던지면 저장하지 않고 예외를 올린다.
    staticSymbolCache: vi.fn(
        async (_k: unknown, _s: unknown, fetcher: () => Promise<unknown>) =>
            fetcher()
    ),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cacheNonEmpty } from '@/shared/cache/cacheNonEmpty';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';

describe('cacheNonEmpty', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('비어 있지 않은 결과는 그대로 돌려주고 인자를 staticSymbolCache에 넘긴다', async () => {
        const rows = await cacheNonEmpty(
            ['k'],
            'SYM',
            async () => [1, 2],
            ['t'],
            60
        );

        expect(rows).toEqual([1, 2]);
        expect(staticSymbolCache).toHaveBeenCalledWith(
            ['k'],
            'SYM',
            expect.any(Function),
            ['t'],
            60
        );
    });

    it('빈 결과는 캐시 쓰기를 막으려 fetcher 안에서 던지고, 바깥에선 []로 돌려준다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const rows = await cacheNonEmpty(['k'], 'SYM', async () => [], [], 60);

        expect(rows).toEqual([]);
        // sentinel은 무음이다.
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('fetcher의 다른 예외는 로그를 남기고 []로 degrade한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const rows = await cacheNonEmpty(
            ['k'],
            'SYM',
            async () => {
                throw new Error('db down');
            },
            [],
            60
        );

        expect(rows).toEqual([]);
        expect(errorSpy).toHaveBeenCalledWith(
            '[cacheNonEmpty] unexpected cache error:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });
});
