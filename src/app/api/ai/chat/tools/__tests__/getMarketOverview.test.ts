import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fgUs, fgKr, summary, sectorSignals } = vi.hoisted(() => ({
    fgUs: vi.fn(),
    fgKr: vi.fn(),
    summary: vi.fn(),
    sectorSignals: vi.fn(),
}));
vi.mock('@/entities/market-fear-greed/api/marketFearGreedStaticCache', () => ({
    getMarketFearGreedStatic: fgUs,
}));
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
    () => ({ getMarketFearGreedKrStatic: fgKr })
);
vi.mock('@/entities/market-summary/api/marketSummaryStaticCache', () => ({
    getMarketSummaryStatic: summary,
}));
vi.mock('@/entities/sector-signal/api/sectorSignalsStaticCache', () => ({
    getSectorSignalsStatic: sectorSignals,
}));

import { getMarketOverviewTool } from '@/app/api/ai/chat/tools/getMarketOverview';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

describe('getMarketOverviewTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        summary.mockResolvedValue({
            indices: [{ symbol: 'SPY', price: 500, changesPercentage: 0.5 }],
            sectors: [{ symbol: 'XLK', price: 200, changesPercentage: -0.2 }],
        });
    });

    it('us는 fear-greed(미국판)·지수·섹터신호를 모두 채운다', async () => {
        fgUs.mockResolvedValue({
            snapshot: {
                score: 62,
                label: 'greed',
                factors: [{ key: 'momentum', rawValue: 1, percentile: 70 }],
            },
            comparisons: [],
        });
        sectorSignals.mockResolvedValue({
            computedAt: '2026-09-14T00:00:00.000Z',
            stocks: [
                {
                    symbol: 'AAPL',
                    koreanName: '애플',
                    sectorSymbol: 'XLK',
                    price: 200,
                    changePercent: 1,
                    trend: 'uptrend',
                    signals: [
                        { type: 'golden_cross', direction: 'bullish' },
                        { type: 'rsi_oversold', direction: 'bullish' },
                    ],
                },
            ],
        });
        const r = (await getMarketOverviewTool({ market: 'us' }, ctx, rt)) as {
            market: string;
            fearGreed: { score: number };
            sectorSignals: {
                countsBySector: Record<string, number>;
                topSignals: unknown[];
            };
        };
        expect(fgKr).not.toHaveBeenCalled();
        expect(r.market).toBe('us');
        expect(r.fearGreed.score).toBe(62);
        expect(r.sectorSignals.countsBySector).toEqual({ XLK: 1 });
        expect(r.sectorSignals.topSignals).toHaveLength(2);
    });

    it('kr은 KR fear-greed를 쓰고 섹터신호는 조회하지 않는다', async () => {
        fgKr.mockResolvedValue({
            snapshot: { score: 40, label: 'fear', factors: [] },
            comparisons: [],
        });
        const r = (await getMarketOverviewTool({ market: 'kr' }, ctx, rt)) as {
            market: string;
            sectorSignals: unknown;
        };
        expect(fgUs).not.toHaveBeenCalled();
        expect(sectorSignals).not.toHaveBeenCalled();
        expect(r.market).toBe('kr');
        expect(r.sectorSignals).toBeNull();
    });

    it('fear-greed 조회가 실패해도(allSettled) 지수·섹터 데이터는 살아남는다', async () => {
        fgUs.mockRejectedValue(new Error('redis down'));
        sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
        const r = (await getMarketOverviewTool({ market: 'us' }, ctx, rt)) as {
            fearGreed: unknown;
            indices: unknown[];
        };
        expect(r.fearGreed).toBeNull();
        expect(r.indices).toEqual([
            { symbol: 'SPY', price: 500, changesPercentage: 0.5 },
        ]);
    });

    it('알 수 없는 market 값은 us로 취급한다', async () => {
        fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
        sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
        const r = (await getMarketOverviewTool({ market: 'jp' }, ctx, rt)) as {
            market: string;
        };
        expect(r.market).toBe('us');
        expect(fgUs).toHaveBeenCalled();
    });
});
