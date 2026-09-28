import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isTabAllowed, getTrades } = vi.hoisted(() => ({
    isTabAllowed: vi.fn(),
    getTrades: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: isTabAllowed,
}));
vi.mock('@/entities/congress-trades', () => ({
    getCongressTradesResilient: getTrades,
}));

import { getCongressTradesTool } from '@/app/api/ai/chat/tools/getCongressTrades';

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

function trade(overrides: Record<string, unknown> = {}) {
    return {
        chamber: 'house',
        firstName: 'Nancy',
        lastName: 'Pelosi',
        office: 'Nancy Pelosi',
        district: 'CA',
        owner: 'self',
        side: 'buy',
        rawType: 'Purchase',
        amount: {
            min: 1_000_001,
            max: 5_000_000,
            label: '$1,000,001 - $5,000,000',
        },
        assetType: 'Stock',
        transactionDate: '2026-08-10',
        disclosureDate: '2026-08-20',
        link: 'https://example.com',
        capitalGainsOver200USD: false,
        ...overrides,
    };
}

describe('getCongressTradesTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isTabAllowed.mockResolvedValue(true);
    });

    it('KR/크립토 등 congress 탭이 없는 심볼은 프로바이더 호출 없이 available:false', async () => {
        isTabAllowed.mockResolvedValue(false);
        const r = await getCongressTradesTool({ symbol: '005930.KS' }, ctx, rt);
        expect(r).toEqual({
            symbol: '005930.KS',
            available: false,
            reason: 'tab_not_available',
        });
        expect(getTrades).not.toHaveBeenCalled();
    });

    it('degraded:true(FMP 인프라 장애)는 available:false로 매핑된다', async () => {
        getTrades.mockResolvedValue({ trades: [], degraded: true });
        const r = await getCongressTradesTool({ symbol: 'AAPL' }, ctx, rt);
        expect(r).toEqual({
            symbol: 'AAPL',
            available: false,
            reason: 'provider_failed',
        });
    });

    it('정상 0건은 degrade가 아니라 available:true·빈 목록', async () => {
        getTrades.mockResolvedValue({ trades: [], degraded: false });
        const r = (await getCongressTradesTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as {
            available: boolean;
            trades: unknown[];
            stats: { buyCount: number };
        };
        expect(r.available).toBe(true);
        expect(r.trades).toEqual([]);
        expect(r.stats.buyCount).toBe(0);
    });

    it('거래는 15건으로 잘리고 통계는 전체 집합으로 집계된다', async () => {
        const trades = Array.from({ length: 20 }, (_, i) =>
            trade({ transactionDate: `2026-08-${(i % 28) + 1}` })
        );
        getTrades.mockResolvedValue({ trades, degraded: false });
        const r = (await getCongressTradesTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as {
            trades: unknown[];
            stats: { buyCount: number };
        };
        expect(r.trades).toHaveLength(15);
        expect(r.stats.buyCount).toBe(20);
    });

    it('member 필드는 성+이름을 합치고 amount는 label만 노출한다', async () => {
        getTrades.mockResolvedValue({ trades: [trade()], degraded: false });
        const r = (await getCongressTradesTool(
            { symbol: 'AAPL' },
            ctx,
            rt
        )) as { trades: Array<{ member: string; amount: string }> };
        expect(r.trades[0]).toEqual({
            transactionDate: '2026-08-10',
            member: 'Nancy Pelosi',
            chamber: 'house',
            side: 'buy',
            amount: '$1,000,001 - $5,000,000',
        });
    });
});
