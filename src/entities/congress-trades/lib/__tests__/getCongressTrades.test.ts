// spy → vi.mock → imports 순서 (MISTAKES.md Tests §17)
const { mockGetTrades, mockProvider, mockStaticSymbolCache } = vi.hoisted(
    () => {
        const mockGetTrades = vi.fn();
        const mockProvider = { getTrades: mockGetTrades };
        // pass-through stub: invoke fetcher directly, bypassing unstable_cache
        // (which needs a Next request context unavailable in unit tests). We
        // still capture the call so we can assert key/tag arguments below.
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
import {
    getCongressTrades,
    CONGRESS_TRADE_LIMIT,
} from '@/entities/congress-trades/lib/getCongressTrades';
import { SECONDS_PER_DAY } from '@/shared/config/time';

describe('getCongressTrades', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetTrades.mockResolvedValue([]);
    });

    it('provider 각 chamber 호출에 CONGRESS_TRADE_LIMIT(50)을 전달한다', async () => {
        await getCongressTrades('AAPL');

        expect(mockGetTrades).toHaveBeenCalledTimes(2);
        expect(mockGetTrades).toHaveBeenCalledWith(
            'AAPL',
            'senate',
            CONGRESS_TRADE_LIMIT
        );
        expect(mockGetTrades).toHaveBeenCalledWith(
            'AAPL',
            'house',
            CONGRESS_TRADE_LIMIT
        );
    });

    it('symbol을 대문자화하여 호출한다 (provider + staticSymbolCache 모두)', async () => {
        await getCongressTrades('aapl');

        expect(mockGetTrades).toHaveBeenCalledWith(
            'AAPL',
            'senate',
            CONGRESS_TRADE_LIMIT
        );
        expect(mockGetTrades).toHaveBeenCalledWith(
            'AAPL',
            'house',
            CONGRESS_TRADE_LIMIT
        );
        // staticSymbolCache의 symbol 인자도 대문자; 5번째 인자는 24h TTL
        expect(mockStaticSymbolCache).toHaveBeenCalledWith(
            ['congress:senate', 'AAPL'],
            'AAPL',
            expect.any(Function),
            ['congress:AAPL'],
            SECONDS_PER_DAY
        );
        expect(mockStaticSymbolCache).toHaveBeenCalledWith(
            ['congress:house', 'AAPL'],
            'AAPL',
            expect.any(Function),
            ['congress:AAPL'],
            SECONDS_PER_DAY
        );
    });

    it('staticSymbolCache는 두 chamber 모두에 congress:<UPPER> 그룹 태그를 전달한다', async () => {
        await getCongressTrades('msft');

        for (const call of mockStaticSymbolCache.mock.calls) {
            const extraTags = call[3] as readonly string[];
            expect(extraTags).toEqual(['congress:MSFT']);
        }
    });

    it('한쪽 chamber가 throw하면 Promise.all 전체가 reject된다', async () => {
        mockGetTrades.mockImplementation(
            async (_symbol: string, chamber: string) => {
                if (chamber === 'senate') throw new Error('FMP senate down');
                return [];
            }
        );

        await expect(getCongressTrades('AAPL')).rejects.toThrow(
            'FMP senate down'
        );
    });

    it('빈 결과는 normalizeCongressTrades를 거쳐 [] 반환', async () => {
        mockGetTrades.mockResolvedValue([]);

        const trades = await getCongressTrades('AAPL');

        expect(trades).toEqual([]);
    });
});
