vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
    markSsrMiss: vi.fn(),
    unstableCache: vi.fn(),
}));

vi.mock('next/cache', () => ({ unstable_cache: mocks.unstableCache }));
vi.mock('@/shared/cache/ssrMissMarker', () => ({
    markSsrMiss: mocks.markSsrMiss,
}));

import { cacheNonNull } from '@/shared/cache/cacheNonNull';

const OPTIONS = { revalidate: 60, tags: ['tag:a', 'tag:b'] } as const;

describe('cacheNonNull', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.markSsrMiss.mockResolvedValue(undefined);
        // unstable_cache의 계약을 흉내 낸다 — 콜백이 던지면 저장하지 않고 예외를 올린다.
        mocks.unstableCache.mockImplementation(
            (fn: () => Promise<unknown>) => () => fn()
        );
    });

    it('null이 아니면 값을 그대로 돌려주고 표시하지 않는다', async () => {
        const result = await cacheNonNull(
            async () => ({ a: 1 }),
            ['k1', 'k2'],
            OPTIONS
        );

        expect(result).toEqual({ a: 1 });
        expect(mocks.markSsrMiss).not.toHaveBeenCalled();
    });

    it('keyParts·revalidate·tags를 unstable_cache에 넘긴다', async () => {
        await cacheNonNull(async () => 1, ['k1', 'k2'], OPTIONS);

        expect(mocks.unstableCache).toHaveBeenCalledWith(
            expect.any(Function),
            ['k1', 'k2'],
            { revalidate: 60, tags: ['tag:a', 'tag:b'] }
        );
    });

    it('null이면 캐시 콜백이 던져 저장을 건너뛰고, 바깥은 null + 첫 태그로 표시한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const result = await cacheNonNull(async () => null, ['k'], OPTIONS);

        const cachedFn = mocks.unstableCache.mock
            .calls[0][0] as () => Promise<unknown>;
        expect(result).toBeNull();
        await expect(cachedFn()).rejects.toThrow();
        expect(mocks.markSsrMiss).toHaveBeenCalledWith('tag:a');
        // 정상적인 null은 에러 로그를 남기지 않는다.
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('예상 밖 에러는 로그를 남기고 null로 degrade하며 표시한다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const result = await cacheNonNull(
            async () => {
                throw new Error('redis down');
            },
            ['k'],
            OPTIONS
        );

        expect(result).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(
            '[cacheNonNull] unexpected cache error:',
            expect.objectContaining({ message: 'redis down' })
        );
        expect(mocks.markSsrMiss).toHaveBeenCalledWith('tag:a');
        errorSpy.mockRestore();
    });
});
