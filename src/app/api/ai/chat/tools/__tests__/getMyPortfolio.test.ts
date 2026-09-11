import { describe, expect, it, vi } from 'vitest';

const { findByUser, profile } = vi.hoisted(() => ({
    findByUser: vi.fn(),
    profile: vi.fn(),
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn(function () {
        return { findByUser };
    }),
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: (id: string) => ({
        priceFormat: { currency: id === 'kr-equity' ? 'KRW' : 'USD' },
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { getMyPortfolioTool } from '@/app/api/ai/chat/tools/getMyPortfolio';

const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

describe('getMyPortfolioTool', () => {
    it('ctx.userId로만 조회하고 args의 다른 userId는 무시된다', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '10',
                averagePrice: '150.5',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        const ctx = {
            userId: 'u1',
            tier: 'member' as const,
            locale: 'ko' as const,
            signal: new AbortController().signal,
        };

        const r = (await getMyPortfolioTool(
            { userId: 'someone-else' },
            ctx,
            rt
        )) as {
            holdings: Array<{
                symbol: string;
                quantity: number;
                averagePrice: number;
                currency: string;
            }>;
        };
        expect(findByUser).toHaveBeenCalledWith('u1');
        expect(findByUser).not.toHaveBeenCalledWith('someone-else');
        expect(r.holdings[0]).toEqual({
            symbol: 'AAPL',
            companyName: 'Apple',
            quantity: 10,
            averagePrice: 150.5,
            currency: 'USD',
        });
    });

    it('보유 종목이 없으면 빈 배열', async () => {
        findByUser.mockResolvedValue([]);
        const ctx = {
            userId: 'u2',
            tier: 'free' as const,
            locale: 'ko' as const,
            signal: new AbortController().signal,
        };
        const r = (await getMyPortfolioTool({}, ctx, rt)) as {
            count: number;
            holdings: unknown[];
        };
        expect(r.count).toBe(0);
        expect(r.holdings).toEqual([]);
    });
});
