import { beforeEach, describe, expect, it, vi } from 'vitest';

const { profile, assetInfo, getQuote, spec } = vi.hoisted(() => ({
    profile: vi.fn(),
    assetInfo: vi.fn(),
    getQuote: vi.fn(),
    spec: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
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
        quoteDelayMinutes: id === 'kr-equity' ? 20 : 0,
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
    beforeEach(() => {
        assetInfo.mockReset();
        assetInfo.mockResolvedValue(null);
    });

    it('KR 심볼은 kr-equity 세션 스펙 + KRW + 20분 지연 표기, 3개로 절단', async () => {
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
            quotes: Array<{ quoteDelayMinutes: number }>;
        };
        expect(r.quotes).toHaveLength(3);
        expect(spec).toHaveBeenCalledWith('kr-equity');
        expect(r.quotes[0]).toMatchObject({
            symbol: '005930.KS',
            currency: 'KRW',
            found: true,
            quoteDelayMinutes: 20,
        });
        expect(r.quotes[1]).toMatchObject({ quoteDelayMinutes: 0 });
    });

    it('fmpSymbol이 있으면 그 값으로 시세를 조회한다', async () => {
        profile.mockResolvedValue('us-equity');
        assetInfo.mockResolvedValue({
            symbol: '^SPX',
            fmpSymbol: '^GSPC',
        });
        getQuote.mockResolvedValue({ price: 5000, changesPercentage: 0.5 });
        await getQuoteTool({ symbols: ['^SPX'] }, ctx, rt);
        expect(getQuote).toHaveBeenCalledWith('^GSPC');
    });

    it('getAssetInfo가 throw해도 canonical 심볼로 조회를 진행한다', async () => {
        profile.mockResolvedValue('us-equity');
        assetInfo.mockRejectedValue(new Error('db down'));
        getQuote.mockResolvedValue({ price: 100, changesPercentage: 0 });
        const r = (await getQuoteTool({ symbols: ['AAPL'] }, ctx, rt)) as {
            quotes: Array<{ found: boolean }>;
        };
        expect(getQuote).toHaveBeenCalledWith('AAPL');
        expect(r.quotes[0]).toMatchObject({ found: true });
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
