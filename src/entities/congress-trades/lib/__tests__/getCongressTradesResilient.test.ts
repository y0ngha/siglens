// spy → vi.mock → imports 순서 (MISTAKES.md Tests §17)
const { mockGetTrades, mockProvider, mockStaticSymbolCache } = vi.hoisted(
    () => {
        const mockGetTrades = vi.fn();
        const mockProvider = { getTrades: mockGetTrades };
        // pass-through stub: invokes the fetcher directly, bypassing unstable_cache
        // (which needs a Next request context unavailable in unit tests).
        const mockStaticSymbolCache = vi.fn(
            (
                _keyParts: readonly string[],
                _symbol: string,
                fetcher: () => Promise<unknown>,
                _extraTags?: readonly string[]
            ) => fetcher()
        );
        return { mockGetTrades, mockProvider, mockStaticSymbolCache };
    }
);

vi.mock('@/shared/api/fmp/getCongressTradesProvider', () => ({
    getCongressTradesProvider: vi.fn(() => mockProvider),
}));

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockStaticSymbolCache,
}));

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCongressTradesResilient } from '@/entities/congress-trades';

describe('getCongressTradesResilient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    it('정상 빈 결과는 degraded:false, trades:[] (거래 없음=정상)', async () => {
        mockGetTrades.mockResolvedValue([]);

        const result = await getCongressTradesResilient('AAPL');

        expect(result).toEqual({ trades: [], degraded: false });
    });

    it('provider throw는 degraded:true, trades:[]', async () => {
        mockGetTrades.mockRejectedValue(new Error('FMP 500'));

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const r = await getCongressTradesResilient('AAPL');

        expect(r.degraded).toBe(true);
        expect(r.trades).toEqual([]);
        expect(errorSpy).toHaveBeenCalledWith(
            '[getCongressTradesResilient] FMP 의회 거래 장애, degrade:',
            expect.any(Error)
        );

        errorSpy.mockRestore();
    });

    it('한쪽(senate)만 throw해도 degraded:true — Promise.all이 전체를 reject한다', async () => {
        mockGetTrades.mockImplementation(
            async (_symbol: string, chamber: string) => {
                if (chamber === 'senate') throw new Error('FMP 500');
                return [];
            }
        );

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const result = await getCongressTradesResilient('AAPL');

        expect(result.degraded).toBe(true);
        expect(result.trades).toEqual([]);

        errorSpy.mockRestore();
    });

    it('정상 거래가 있으면 normalize되어 정렬된 CongressTrade[] 반환', async () => {
        const senateRaw = [
            {
                type: 'Purchase',
                transactionDate: '2026-04-17',
                amount: '$1,001 - $15,000',
                office: 'X',
                firstName: 'A',
                lastName: 'B',
                district: 'WV',
                owner: 'Self',
                assetType: 'Stock',
                assetDescription: 'Apple',
                disclosureDate: '2026-05-07',
                link: '',
                capitalGainsOver200USD: 'False',
            },
        ];

        mockGetTrades.mockImplementation(
            async (_symbol: string, chamber: string) =>
                chamber === 'senate' ? senateRaw : []
        );

        const r = await getCongressTradesResilient('AAPL');

        expect(r.degraded).toBe(false);
        expect(r.trades).toHaveLength(1);
        expect(r.trades[0].side).toBe('buy'); // normalized from 'Purchase'
        expect(r.trades[0].chamber).toBe('senate'); // tagged by normalizeCongressTrades
    });

    it('DYNAMIC_SERVER_USAGE는 삼키지 않고 그대로 re-throw한다', async () => {
        const dynamicErr = Object.assign(new Error('Dynamic server usage'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mockGetTrades.mockRejectedValue(dynamicErr);

        await expect(getCongressTradesResilient('AAPL')).rejects.toBe(
            dynamicErr
        );
    });

    it('E2E 모드에서 FMP 장애는 degraded:true이지만 console.error 출력 없음', async () => {
        vi.stubEnv('E2E_TEST', '1');
        mockGetTrades.mockRejectedValue(new Error('FMP 429'));

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const r = await getCongressTradesResilient('AAPL');

        expect(r.degraded).toBe(true);
        expect(r.trades).toEqual([]);
        expect(errorSpy).not.toHaveBeenCalled();

        errorSpy.mockRestore();
    });
});
