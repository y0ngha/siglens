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
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

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

    it('옵션 프리미엄은 센트 단위로 반올림해 센트 미만 가격이 모델에 가지 않는다', async () => {
        hasMarket.mockResolvedValue(true);
        fetchSnapshot.mockResolvedValue({
            capturedAt: '2026-10-16T20:00:00Z',
            underlyingPrice: 214.13,
            chains: [{ expirationDate: '2026-10-19', daysToExpiration: 3 }],
        });
        summarize.mockReturnValue({
            topOiBidAskSummary: [
                {
                    strike: 250,
                    callMidPrice: 0.005,
                    callSpread: 0.01,
                    putMidPrice: 13.325,
                    putSpread: 0.15,
                    callSpreadPct: 200,
                    putSpreadPct: 1.1257,
                },
                {
                    strike: 260,
                    callMidPrice: 0.004,
                    callSpread: 0.008,
                    putMidPrice: 45.5,
                    putSpread: Number.NaN,
                    callSpreadPct: 200,
                    putSpreadPct: null,
                },
                {
                    strike: 220,
                    callMidPrice: null,
                    callSpread: null,
                    putMidPrice: 0.095,
                    putSpread: 0.01,
                    callSpreadPct: null,
                    putSpreadPct: 10.5263,
                },
            ],
        });
        const r = (await getOptionsSummaryTool(
            { symbol: 'NVDA' },
            ctx,
            rt
        )) as {
            metrics: {
                topOiBidAskSummary: {
                    callMidPrice: number | null;
                    putMidPrice: number | null;
                    putSpread: number | null;
                    putSpreadPct: number | null;
                }[];
            };
        };
        const [far, tiny, near] = r.metrics.topOiBidAskSummary;
        // 반 센트 미만은 0, 이미 센트 단위인 값은 그대로, 유한하지 않은 값은 null.
        expect(tiny!.callMidPrice).toBe(0);
        expect(tiny!.putMidPrice).toBe(45.5);
        expect(tiny!.putSpread).toBeNull();
        expect(far!.callMidPrice).toBe(0.01);
        expect(far!.putMidPrice).toBe(13.33);
        expect(near!.callMidPrice).toBeNull();
        expect(near!.putMidPrice).toBe(0.1);
        // 스프레드 %는 원 호가로 계산된 값을 유지한다(유효숫자 트림만).
        expect(near!.putSpreadPct).toBe(10.5263);
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
        summarize.mockReturnValue({ maxPain: 195, topOiBidAskSummary: [] });
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
        expect(r.metrics).toEqual({ maxPain: 195, topOiBidAskSummary: [] });
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
        summarize.mockReturnValue({ maxPain: 195, topOiBidAskSummary: [] });
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
        summarize.mockReturnValue({ maxPain: 195, topOiBidAskSummary: [] });
        const r = (await getOptionsSummaryTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as { expiration: string; otherExpirations: string[] };
        expect(r.expiration).toBe('2026-09-10');
        expect(r.otherExpirations).toEqual([]);
    });
});
