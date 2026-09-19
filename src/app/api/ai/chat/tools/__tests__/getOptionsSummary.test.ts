import { beforeEach, describe, expect, it, vi } from 'vitest';

const { hasMarket, fetchSnapshot, summarize, isTabAllowed } = vi.hoisted(
    () => ({
        hasMarket: vi.fn(),
        fetchSnapshot: vi.fn(),
        summarize: vi.fn(),
        isTabAllowed: vi.fn(),
    })
);
vi.mock('@/entities/options-chain/lib/optionsDataCache', () => ({
    hasOptionsMarket: hasMarket,
    fetchOptionsSnapshot: fetchSnapshot,
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: isTabAllowed,
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return { ...actual, summarizeChainForLlm: summarize };
});

import { getOptionsSummaryTool } from '@/app/api/ai/chat/tools/getOptionsSummary';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

describe('getOptionsSummaryTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isTabAllowed.mockResolvedValue(true);
    });

    it('크립토/KR 등 options 탭이 없는 심볼은 프로브 없이 available:false', async () => {
        isTabAllowed.mockResolvedValue(false);
        const r = await getOptionsSummaryTool({ symbol: 'BTCUSD' }, ctx, rt);
        expect(r).toEqual({
            symbol: 'BTCUSD',
            available: false,
            reason: 'tab_not_available',
        });
        expect(hasMarket).not.toHaveBeenCalled();
        expect(fetchSnapshot).not.toHaveBeenCalled();
    });

    it('rounds binary-float noise in the core metrics before the model sees them', async () => {
        hasMarket.mockResolvedValue(true);
        fetchSnapshot.mockResolvedValue({
            capturedAt: '2026-09-18T19:50:00Z',
            underlyingPrice: 219.62,
            chains: [{ expirationDate: '2026-09-25', daysToExpiration: 7 }],
        });
        summarize.mockReturnValue({
            expirationDate: '2026-09-25',
            impliedMoveRange: {
                low: 211.68583261014928,
                high: 227.55416738985073,
            },
            topOiBidAskSummary: [
                { strike: 220, callSpread: 0.050000000000000266 },
            ],
        });
        const r = (await getOptionsSummaryTool(
            { symbol: 'NVDA' },
            ctx,
            rt
        )) as {
            metrics: {
                impliedMoveRange: { low: number; high: number };
                topOiBidAskSummary: { strike: number; callSpread: number }[];
            };
        };
        expect(r.metrics.impliedMoveRange).toEqual({
            low: 211.686,
            high: 227.554,
        });
        expect(r.metrics.topOiBidAskSummary[0]!.callSpread).toBe(0.05);
        expect(r.metrics.topOiBidAskSummary[0]!.strike).toBe(220);
    });

    it('옵션 시장이 없으면 available:false', async () => {
        hasMarket.mockResolvedValue(false);
        expect(
            await getOptionsSummaryTool({ symbol: 'AAPL' }, ctx, rt)
        ).toEqual({
            symbol: 'AAPL',
            available: false,
            reason: 'no_options_market',
        });
        expect(fetchSnapshot).not.toHaveBeenCalled();
    });

    it('체인이 있으면 metrics·otherExpirations를 채운다', async () => {
        hasMarket.mockResolvedValue(true);
        fetchSnapshot.mockResolvedValue({
            underlyingPrice: 200,
            capturedAt: '2026-09-10T00:00:00.000Z',
            chains: [
                { expirationDate: '2026-10-01', daysToExpiration: 21 },
                { expirationDate: '2026-10-08', daysToExpiration: 28 },
            ],
        });
        summarize.mockReturnValue({ maxPain: 195 });
        const r = (await getOptionsSummaryTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as {
            available: boolean;
            metrics: unknown;
            otherExpirations: string[];
        };
        expect(r.available).toBe(true);
        expect(r.metrics).toEqual({ maxPain: 195 });
        expect(r.otherExpirations).toEqual(['2026-10-08']);
    });

    it('snapshot이 null이면 available:false', async () => {
        hasMarket.mockResolvedValue(true);
        fetchSnapshot.mockResolvedValue(null);
        expect(
            await getOptionsSummaryTool({ symbol: 'AAPL' }, ctx, rt)
        ).toEqual({ symbol: 'AAPL', available: false, reason: 'no_snapshot' });
    });

    it('chains[0]이 당일 만기(daysToExpiration 0)면 건너뛰고 D+1 이상인 첫 체인을 선택한다', async () => {
        hasMarket.mockResolvedValue(true);
        fetchSnapshot.mockResolvedValue({
            underlyingPrice: 200,
            capturedAt: '2026-09-10T00:00:00.000Z',
            chains: [
                { expirationDate: '2026-09-10', daysToExpiration: 0 },
                { expirationDate: '2026-10-01', daysToExpiration: 21 },
                { expirationDate: '2026-10-08', daysToExpiration: 28 },
                { expirationDate: '2026-10-15', daysToExpiration: 35 },
            ],
        });
        summarize.mockReturnValue({ maxPain: 195 });
        const r = (await getOptionsSummaryTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as {
            expiration: string;
            daysToExpiration: number;
            otherExpirations: string[];
        };
        expect(r.expiration).toBe('2026-10-01');
        expect(r.daysToExpiration).toBe(21);
        // excludes the chosen chain (index 1), not just chains[0]
        expect(r.otherExpirations).toEqual([
            '2026-09-10',
            '2026-10-08',
            '2026-10-15',
        ]);
        expect(summarize).toHaveBeenCalledWith(
            { expirationDate: '2026-10-01', daysToExpiration: 21 },
            200
        );
    });

    it('모든 체인이 당일 만기면 chains[0]으로 폴백한다', async () => {
        hasMarket.mockResolvedValue(true);
        fetchSnapshot.mockResolvedValue({
            underlyingPrice: 200,
            capturedAt: '2026-09-10T00:00:00.000Z',
            chains: [{ expirationDate: '2026-09-10', daysToExpiration: 0 }],
        });
        summarize.mockReturnValue({ maxPain: 195 });
        const r = (await getOptionsSummaryTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as { expiration: string; otherExpirations: string[] };
        expect(r.expiration).toBe('2026-09-10');
        expect(r.otherExpirations).toEqual([]);
    });
});
