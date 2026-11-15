import type {
    SectorSignalsResult,
    StockSignalResult,
} from '@y0ngha/siglens-core';
import {
    loadMarketPicks,
    MARKET_PICKS_PER_MARKET,
    type MarketPickSources,
} from '@/app/api/cron/email-report/loadMarketPicks';
import type { DashboardScope } from '@/shared/config/dashboardScope';

function stock(symbol: string): StockSignalResult {
    return {
        symbol,
        koreanName: `${symbol}이름`,
        sectorSymbol: 'XLK',
        price: 100,
        changePercent: 1,
        trend: 'uptrend',
        signals: [
            {
                type: 'golden_cross',
                phase: 'confirmed',
                direction: 'bullish',
                detectedAt: 0,
            },
        ],
    };
}

function result(symbols: readonly string[]): SectorSignalsResult {
    return {
        stocks: symbols.map(stock),
        computedAt: '2026-11-14T21:30:00Z',
    } as unknown as SectorSignalsResult;
}

function sources(
    byScope: Record<string, () => Promise<SectorSignalsResult>>
): MarketPickSources {
    return {
        getSignals: (scope: DashboardScope) => byScope[scope.id]!(),
    };
}

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('loadMarketPicks', () => {
    it('미국, 그다음 한국 순서로 시장마다 상한까지 싣는다', async () => {
        const us = Array.from({ length: 8 }, (_, i) => `U${i}`);
        const picks = await loadMarketPicks(
            sources({
                us: async () => result(us),
                kr: async () => result(['005930.KS']),
            })
        );

        expect(picks).toHaveLength(MARKET_PICKS_PER_MARKET + 1);
        expect(picks.at(-1)).toBe('005930.KS');
        expect(picks.slice(0, MARKET_PICKS_PER_MARKET)).toEqual(
            expect.arrayContaining([expect.stringMatching(/^U\d$/)])
        );
    });

    it('한 시장 조회가 실패하면 그 시장만 비운다', async () => {
        const picks = await loadMarketPicks(
            sources({
                us: async () => {
                    throw new Error('fmp down');
                },
                kr: async () => result(['005930.KS']),
            })
        );

        expect(picks).toEqual(['005930.KS']);
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('신호 종목이 없으면 빈 목록이다', async () => {
        await expect(
            loadMarketPicks(
                sources({
                    us: async () => result([]),
                    kr: async () => result([]),
                })
            )
        ).resolves.toEqual([]);
    });
});
