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

    it('크립토/KR 등 options 탭이 없는 심볼은 프로브 없이 available:false (item 8)', async () => {
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
});
