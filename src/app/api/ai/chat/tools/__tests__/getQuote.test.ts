import { describe, expect, it, vi } from 'vitest';

const { profile, getQuote, spec } = vi.hoisted(() => ({
    profile: vi.fn(),
    getQuote: vi.fn(),
    spec: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: spec }));
vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: (id: string) => ({
        priceFormat: { currency: id === 'kr-equity' ? 'KRW' : 'USD' },
    }),
}));

import { getQuoteTool } from '@/app/api/ai/chat/tools/getQuote';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

describe('getQuoteTool', () => {
    it('KR 심볼은 kr-equity 세션 스펙 + KRW, 3개로 절단', async () => {
        profile.mockImplementation(async (s: string) =>
            s.endsWith('.KS') ? 'kr-equity' : 'us-equity'
        );
        getQuote.mockResolvedValue({
            symbol: 'x',
            price: 71000,
            changesPercentage: 1.2,
        });
        const r = (await getQuoteTool(
            { symbols: ['005930.KS', 'AAPL', 'MSFT', 'NVDA'] },
            ctx,
            rt
        )) as {
            quotes: unknown[];
        };
        expect(r.quotes).toHaveLength(3);
        expect(spec).toHaveBeenCalledWith('kr-equity');
        expect(r.quotes[0]).toMatchObject({
            symbol: '005930.KS',
            currency: 'KRW',
            found: true,
        });
    });

    it('provider가 null을 돌려주면 found:false', async () => {
        profile.mockResolvedValue('us-equity');
        getQuote.mockResolvedValue(null);
        const r = (await getQuoteTool({ symbols: ['AAPL'] }, ctx, rt)) as {
            quotes: Array<{ found: boolean }>;
        };
        expect(r.quotes[0]).toEqual({ symbol: 'AAPL', found: false });
    });

    it('일부 심볼 조회가 실패해도 나머지는 정상 반환한다 (item 9, Promise.allSettled)', async () => {
        profile.mockResolvedValue('us-equity');
        getQuote.mockImplementation(async (symbol: string) => {
            if (symbol === 'BAD') throw new Error('FMP 429');
            return { symbol, price: 200, changesPercentage: -0.5 };
        });
        const r = (await getQuoteTool(
            { symbols: ['AAPL', 'BAD', 'MSFT'] },
            ctx,
            rt
        )) as {
            quotes: Array<{ symbol: string; found: boolean }>;
        };
        expect(r.quotes).toHaveLength(3);
        expect(r.quotes[0]).toMatchObject({ symbol: 'AAPL', found: true });
        expect(r.quotes[1]).toEqual({ symbol: 'BAD', found: false });
        expect(r.quotes[2]).toMatchObject({ symbol: 'MSFT', found: true });
    });
});
