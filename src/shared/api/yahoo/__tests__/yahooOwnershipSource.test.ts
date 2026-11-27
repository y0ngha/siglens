vi.mock('server-only', () => ({}));

const { quoteSummary, cache, e2e } = vi.hoisted(() => ({
    quoteSummary: vi.fn(),
    cache: { shouldCache: [] as boolean[] },
    e2e: { fake: false },
}));
vi.mock('@/shared/api/yahoo/createYahooClient', () => ({
    getYahooClient: () => ({ quoteSummary }),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode: () => e2e.fake }));
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async (
        _key: string,
        _ttl: number,
        fetcher: () => Promise<unknown>,
        shouldCache: (value: unknown) => boolean
    ) => {
        const value = await fetcher();
        cache.shouldCache = [...cache.shouldCache, shouldCache(value)];
        return value;
    },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getYahooOwnershipShares } from '../yahooOwnershipSource';

beforeEach(() => {
    quoteSummary.mockReset();
    cache.shouldCache = [];
    e2e.fake = false;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('getYahooOwnershipShares', () => {
    it('비율을 퍼센트로 바꾸고 보유 기관 수를 싣는다(2026-11-16 NVDA 응답 모양)', async () => {
        quoteSummary.mockResolvedValue({
            majorHoldersBreakdown: {
                maxAge: 1,
                insidersPercentHeld: 0.04156,
                institutionsPercentHeld: 0.71169,
                institutionsFloatPercentHeld: 0.74254996,
                institutionsCount: 7773,
            },
        });
        expect(await getYahooOwnershipShares('NVDA')).toEqual({
            institutionsPct: 71.17,
            institutionsFloatPct: 74.25,
            insidersPct: 4.16,
            institutionCount: 7773,
        });
        expect(quoteSummary).toHaveBeenCalledWith(
            'NVDA',
            { modules: ['majorHoldersBreakdown'] },
            { validateResult: false }
        );
        expect(cache.shouldCache).toEqual([true]);
    });

    it('값이 하나도 없으면 null이고 캐시하지 않는다', async () => {
        quoteSummary.mockResolvedValue({
            majorHoldersBreakdown: { maxAge: 1 },
        });
        expect(await getYahooOwnershipShares('XYZ')).toBeNull();
        expect(cache.shouldCache).toEqual([false]);
    });

    it('실패는 던지지 않고 null, E2E fake 모드는 요청하지 않는다', async () => {
        quoteSummary.mockRejectedValue(new Error('429'));
        expect(await getYahooOwnershipShares('NVDA')).toBeNull();
        e2e.fake = true;
        quoteSummary.mockClear();
        expect(await getYahooOwnershipShares('NVDA')).toBeNull();
        expect(quoteSummary).not.toHaveBeenCalled();
    });
});
