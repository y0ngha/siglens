// vi.mock 호이스팅: import 이전에 선언 (MISTAKES.md Tests §17)
const { mockGetOrSetCache } = vi.hoisted(() => {
    const mockGetOrSetCache = vi.fn();
    return { mockGetOrSetCache };
});

vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: mockGetOrSetCache,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedListWithLimit } from '@/shared/api/fmp/cachedListWithLimit';

const KEY = 'test:key';
const TTL = 60;

afterEach(() => {
    vi.clearAllMocks();
});

describe('cachedListWithLimit — 정상 동작 (slice 적용)', () => {
    beforeEach(() => {
        // getOrSetCache가 fetcher 결과를 그대로 반환하는 기본 동작 시뮬레이션
        mockGetOrSetCache.mockImplementation(
            (_key: unknown, _ttl: unknown, fetcher: () => Promise<unknown>) =>
                fetcher()
        );
    });

    it('max보다 긴 배열을 slice(0, max)로 잘라 반환한다', async () => {
        const full = [1, 2, 3, 4, 5];
        const fetcher = vi.fn(async () => full);

        const result = await cachedListWithLimit(KEY, TTL, 3, fetcher);

        expect(result).toEqual([1, 2, 3]);
        expect(result).toHaveLength(3);
    });

    it('배열 길이 ≤ max이면 전체를 그대로 반환한다', async () => {
        const full = [10, 20];
        const fetcher = vi.fn(async () => full);

        const result = await cachedListWithLimit(KEY, TTL, 5, fetcher);

        expect(result).toEqual([10, 20]);
    });

    it('max = 0이면 빈 배열을 반환한다', async () => {
        const full = [1, 2, 3];
        const fetcher = vi.fn(async () => full);

        const result = await cachedListWithLimit(KEY, TTL, 0, fetcher);

        expect(result).toEqual([]);
    });
});

describe('cachedListWithLimit — logPrefix passthrough', () => {
    it("onError='empty' 시 logPrefix가 console.error 첫 인자로 전달된다", async () => {
        const error = new Error('FMP 503');
        mockGetOrSetCache.mockRejectedValue(error);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await cachedListWithLimit(
            KEY,
            TTL,
            10,
            vi.fn(async () => []),
            {
                onError: 'empty',
                logPrefix: '[test-prefix]',
            }
        );

        expect(spy).toHaveBeenCalledWith('[test-prefix]', error);
        spy.mockRestore();
    });
});

describe("cachedListWithLimit — onError: 'empty' (기본값)", () => {
    it('getOrSetCache 거부 시 [] 반환 + console.error 호출', async () => {
        const error = new Error('Redis 연결 실패');
        mockGetOrSetCache.mockRejectedValue(error);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await cachedListWithLimit<string>(
            KEY,
            TTL,
            10,
            vi.fn(async () => [])
        );

        expect(result).toEqual([]);
        expect(spy).toHaveBeenCalledWith('', error);
        spy.mockRestore();
    });

    it('opts 미전달 시에도 기본값 empty로 동작한다', async () => {
        const error = new Error('timeout');
        mockGetOrSetCache.mockRejectedValue(error);
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // opts 인자 없이 호출
        const result = await cachedListWithLimit<number>(
            KEY,
            TTL,
            5,
            vi.fn(async () => [])
        );

        expect(result).toEqual([]);
        // opts 미전달 시 logPrefix 기본값('')으로 console.error가 호출돼야 한다
        expect(spy).toHaveBeenCalledWith('', error);
        spy.mockRestore();
    });
});

describe("cachedListWithLimit — onError: 'rethrow'", () => {
    it('getOrSetCache 거부 시 에러를 그대로 전파한다', async () => {
        const error = new Error('FMP 500 Internal Server Error');
        mockGetOrSetCache.mockRejectedValue(error);

        await expect(
            cachedListWithLimit<string>(
                KEY,
                TTL,
                10,
                vi.fn(async () => []),
                {
                    onError: 'rethrow',
                }
            )
        ).rejects.toThrow('FMP 500 Internal Server Error');
    });

    it("onError: 'rethrow'이면 console.error를 호출하지 않는다", async () => {
        mockGetOrSetCache.mockRejectedValue(new Error('boom'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(
            cachedListWithLimit<string>(
                KEY,
                TTL,
                10,
                vi.fn(async () => []),
                {
                    onError: 'rethrow',
                }
            )
        ).rejects.toThrow();

        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
