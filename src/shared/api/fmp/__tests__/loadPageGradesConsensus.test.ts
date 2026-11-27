const { getGrades, cacheStore, staticSymbolCache } = vi.hoisted(() => {
    const cacheStore = new Map<string, unknown>();
    return {
        getGrades: vi.fn(),
        cacheStore,
        // 실제 data cache처럼: fetcher가 resolve할 때만 저장하고, reject는 저장 없이 전파한다.
        staticSymbolCache: vi.fn(
            async (
                keyParts: readonly string[],
                _symbol: string,
                fetcher: () => Promise<unknown>
            ) => {
                const key = keyParts.join('|');
                if (cacheStore.has(key)) return cacheStore.get(key);
                const value = await fetcher();
                cacheStore.set(key, value);
                return value;
            }
        ),
    };
});
vi.mock('@/shared/cache/staticSymbolCache', () => ({ staticSymbolCache }));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: () => ({ getGradesConsensus: getGrades }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPageGradesConsensus } from '@/shared/api/fmp/loadPageGradesConsensus';

const COUNTS = { strongBuy: 40, buy: 70, hold: 32, sell: 2, strongSell: 1 };

describe('loadPageGradesConsensus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cacheStore.clear();
    });

    it('정상 값은 그대로 돌려주고 페이지 캐시에 저장한다(yahooFailed: false)', async () => {
        getGrades.mockResolvedValue({ ...COUNTS, source: 'yahoo' });
        await expect(loadPageGradesConsensus('AAPL')).resolves.toEqual({
            grades: { ...COUNTS, source: 'yahoo' },
            yahooFailed: false,
        });
        expect(cacheStore.size).toBe(1);
        expect(staticSymbolCache).toHaveBeenCalledWith(
            ['fundamental:grades-consensus-v2', 'AAPL'],
            'AAPL',
            expect.any(Function),
            [],
            86400
        );
    });

    it('값이 없으면(null) 그것도 정상이다', async () => {
        getGrades.mockResolvedValue(null);
        await expect(loadPageGradesConsensus('SPY')).resolves.toEqual({
            grades: null,
            yahooFailed: false,
        });
    });

    it('yahooFailed 값은 캐시에 저장되지 않고, 표시를 벗긴 fmp fallback으로 돌아온다', async () => {
        getGrades.mockResolvedValue({
            ...COUNTS,
            source: 'fmp',
            yahooFailed: true,
        });
        const result = await loadPageGradesConsensus('AAPL');
        expect(result).toEqual({
            grades: { ...COUNTS, source: 'fmp' },
            yahooFailed: true,
        });
        expect(result.grades).not.toHaveProperty('yahooFailed');
        expect(cacheStore.size).toBe(0);
    });

    it('다음 호출은 캐시에 남은 것이 없어 다시 로드한다(장애가 풀리면 회복)', async () => {
        getGrades.mockResolvedValueOnce({
            ...COUNTS,
            source: 'fmp',
            yahooFailed: true,
        });
        await loadPageGradesConsensus('AAPL');
        getGrades.mockResolvedValueOnce({ ...COUNTS, source: 'yahoo' });
        await expect(loadPageGradesConsensus('AAPL')).resolves.toMatchObject({
            yahooFailed: false,
            grades: { source: 'yahoo' },
        });
        expect(cacheStore.size).toBe(1);
    });

    it('그 밖의 오류(FMP 실패)는 그대로 전파한다', async () => {
        getGrades.mockRejectedValue(new Error('fmp down'));
        await expect(loadPageGradesConsensus('AAPL')).rejects.toThrow(
            'fmp down'
        );
        expect(cacheStore.size).toBe(0);
    });
});
