import { describe, expect, it, vi } from 'vitest';

const { findByUser, profile, getQuote } = vi.hoisted(() => ({
    findByUser: vi.fn(),
    profile: vi.fn(),
    getQuote: vi.fn(),
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn(function () {
        return { findByUser };
    }),
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(),
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
import { roundNumber } from '@/entities/bars/lib/roundIndicators';
import { QUOTE_LOOKUP_TIMEOUT_MS } from '@/shared/api/market/quoteTimeout';

const rt = { analysisModel: 'deepseek-v4.1-flash' as const };
const ctxFor = (userId: string) => ({
    userId,
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
});

describe('getMyPortfolioTool', () => {
    it('ctx.userId로만 조회하고 args의 다른 userId는 무시된다, 시세로 P/L을 계산한다 (spec §3.3, B5)', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '10',
                averagePrice: '150.5',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        getQuote.mockResolvedValue({ price: 200, changesPercentage: 1.5 });

        const r = (await getMyPortfolioTool(
            { userId: 'someone-else' },
            ctxFor('u1'),
            rt
        )) as {
            holdings: Array<{
                symbol: string;
                quantity: number;
                averagePrice: number;
                currency: string;
                price: number | null;
                dayChangePct: number | null;
                marketValue: number | null;
                costBasis: number;
                pnl: number | null;
                pnlPct: number | null;
                weightPct: number | null;
            }>;
            totals: Array<{
                currency: string;
                marketValue: number | null;
                costBasis: number;
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
            price: 200,
            dayChangePct: 1.5,
            marketValue: 2000, // 10 * 200
            costBasis: 1505, // 10 * 150.5
            pnl: 495, // 2000 - 1505
            pnlPct: expect.closeTo(((2000 - 1505) / 1505) * 100, 4),
            weightPct: 100, // sole USD holding
        });
        expect(r.totals).toEqual([
            {
                currency: 'USD',
                marketValue: 2000,
                costBasis: 1505,
                pnl: 495,
                pnlPct: expect.any(Number),
            },
        ]);
    });

    it('보유 종목이 없으면 빈 배열', async () => {
        findByUser.mockResolvedValue([]);
        const r = (await getMyPortfolioTool({}, ctxFor('u2'), rt)) as {
            count: number;
            holdings: unknown[];
            totals: unknown[];
        };
        expect(r.count).toBe(0);
        expect(r.holdings).toEqual([]);
        expect(r.totals).toEqual([]);
    });

    it('시세 조회 실패 시 price/marketValue/pnl/pnlPct/weightPct는 null이지만 보유 종목은 그대로 나열되고, degrade가 로그된다', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            findByUser.mockResolvedValue([
                {
                    symbol: 'TSLA',
                    companyName: 'Tesla',
                    quantity: '5',
                    averagePrice: '200',
                },
            ]);
            profile.mockResolvedValue('us-equity');
            getQuote.mockRejectedValue(new Error('FMP down'));

            const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
                holdings: Array<{
                    price: number | null;
                    marketValue: number | null;
                    pnl: number | null;
                    pnlPct: number | null;
                    weightPct: number | null;
                    costBasis: number;
                }>;
            };
            expect(r.holdings[0]!.price).toBeNull();
            expect(r.holdings[0]!.marketValue).toBeNull();
            expect(r.holdings[0]!.pnl).toBeNull();
            expect(r.holdings[0]!.pnlPct).toBeNull();
            expect(r.holdings[0]!.weightPct).toBeNull();
            expect(r.holdings[0]!.costBasis).toBe(1000); // always known — no quote needed
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[AgentTool]',
                'get_my_portfolio',
                'quote lookup failed, degrading',
                { errorName: 'Error', code: undefined }
            );
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('통화가 섞이면 weightPct는 같은 통화 그룹 내 비중이고 weightScope:currency가 붙는다', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '10',
                averagePrice: '100',
            },
            {
                symbol: '005930',
                companyName: 'Samsung',
                quantity: '10',
                averagePrice: '70000',
            },
        ]);
        profile.mockImplementation(async (symbol: string) =>
            symbol === '005930' ? 'kr-equity' : 'us-equity'
        );
        getQuote.mockImplementation(async (symbol: string) =>
            symbol === '005930'
                ? { price: 80000, changesPercentage: 2 }
                : { price: 150, changesPercentage: 1 }
        );

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            weightScope?: string;
            holdings: Array<{ symbol: string; weightPct: number | null }>;
            totals: Array<{ currency: string; marketValue: number | null }>;
        };
        expect(r.weightScope).toBe('currency');
        // Each holding is the ONLY one in its currency group → 100% within that group.
        expect(r.holdings.find(h => h.symbol === 'AAPL')!.weightPct).toBe(100);
        expect(r.holdings.find(h => h.symbol === '005930')!.weightPct).toBe(
            100
        );
        expect(r.totals).toHaveLength(2);
    });

    it('한 통화 그룹 안에서 일부 시세가 실패하면 그 그룹의 total.marketValue/pnl과 그룹 내 모든 weightPct가 null이다 (null rule)', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '10',
                averagePrice: '100',
            },
            {
                symbol: 'MSFT',
                companyName: 'Microsoft',
                quantity: '5',
                averagePrice: '300',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        getQuote.mockImplementation(async (symbol: string) =>
            symbol === 'AAPL'
                ? { price: 150, changesPercentage: 1 }
                : Promise.reject(new Error('FMP down'))
        );

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ symbol: string; weightPct: number | null }>;
            totals: Array<{
                currency: string;
                marketValue: number | null;
                pnl: number | null;
            }>;
        };
        expect(r.totals[0]!.marketValue).toBeNull();
        expect(r.totals[0]!.pnl).toBeNull();
        expect(r.holdings.find(h => h.symbol === 'AAPL')!.weightPct).toBeNull();
        expect(r.holdings.find(h => h.symbol === 'MSFT')!.weightPct).toBeNull();
    });

    it('시세 price가 0/음수면(실패를 0으로 표현) price/dayChangePct/marketValue/pnl/pnlPct 전부 null — -100% pnlPct로 읽히면 안 된다', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '10',
                averagePrice: '150',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        getQuote.mockResolvedValue({ price: 0, changesPercentage: -100 });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{
                price: number | null;
                dayChangePct: number | null;
                marketValue: number | null;
                pnl: number | null;
                pnlPct: number | null;
            }>;
        };
        expect(r.holdings[0]!.price).toBeNull();
        expect(r.holdings[0]!.dayChangePct).toBeNull();
        expect(r.holdings[0]!.marketValue).toBeNull();
        expect(r.holdings[0]!.pnl).toBeNull();
        expect(r.holdings[0]!.pnlPct).toBeNull();

        getQuote.mockResolvedValue({ price: -20, changesPercentage: 1 });
        const r2 = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ price: number | null }>;
        };
        expect(r2.holdings[0]!.price).toBeNull();
    });

    it('통화 그룹 합계는 반올림된 개별 종목값이 아니라 원시 합계를 반올림한다 (이중 반올림 방지)', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '1',
                averagePrice: '1',
            },
            {
                symbol: 'MSFT',
                companyName: 'Microsoft',
                quantity: '1',
                averagePrice: '1',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        // Each holding's OWN marketValue rounds to exactly 1 (6 significant
        // digits of 1.00000499 → "1.00000" → 1) — but the group total must
        // be `roundNumber` of the RAW sum (2.00000998 → 2.00001), not the
        // sum of the two already-rounded holdings (which would be exactly
        // 2, the double-rounding bug this fix removes).
        getQuote.mockResolvedValue({ price: 1.00000499, changesPercentage: 0 });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ marketValue: number | null }>;
            totals: Array<{ marketValue: number | null }>;
        };
        expect(r.holdings[0]!.marketValue).toBe(1);
        expect(r.holdings[1]!.marketValue).toBe(1);
        expect(r.totals[0]!.marketValue).toBe(roundNumber(1.00000499 * 2));
        expect(r.totals[0]!.marketValue).not.toBe(2);
    });

    it('시세 조회가 멈춰도 QUOTE_LOOKUP_TIMEOUT_MS(5s) 내에 price:null로 진행된다', async () => {
        vi.useFakeTimers();
        try {
            findByUser.mockResolvedValue([
                {
                    symbol: 'AAPL',
                    companyName: 'Apple',
                    quantity: '10',
                    averagePrice: '150',
                },
            ]);
            profile.mockResolvedValue('us-equity');
            getQuote.mockImplementation(() => new Promise(() => {})); // never resolves

            const resultPromise = getMyPortfolioTool(
                {},
                ctxFor('u1'),
                rt
            ) as Promise<{ holdings: Array<{ price: number | null }> }>;
            await vi.advanceTimersByTimeAsync(QUOTE_LOOKUP_TIMEOUT_MS);
            const r = await resultPromise;
            expect(r.holdings[0]!.price).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('시세 조회는 QUOTE_CONCURRENCY(5)를 넘지 않게 청크로 제한되고, 순서와 값은 그대로 유지된다 (MISTAKES.md §0.8)', async () => {
        const holdings = Array.from({ length: 12 }, (_, i) => ({
            symbol: `SYM${i}`,
            companyName: `Company ${i}`,
            quantity: '1',
            averagePrice: '10',
        }));
        findByUser.mockResolvedValue(holdings);
        profile.mockResolvedValue('us-equity');

        let inFlight = 0;
        let maxInFlight = 0;
        getQuote.mockImplementation(async (symbol: string) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            // Real delay (not just a microtask hop) so all concurrently
            // dispatched lookups are genuinely in-flight at once, instead
            // of relying on exact microtask-scheduling order.
            await new Promise(resolve => setTimeout(resolve, 10));
            inFlight--;
            const index = Number(symbol.slice(3));
            return { price: 100 + index, changesPercentage: index };
        });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ symbol: string; price: number | null }>;
        };

        expect(maxInFlight).toBeLessThanOrEqual(5);
        expect(r.holdings.map(h => h.symbol)).toEqual(
            holdings.map(h => h.symbol)
        );
        r.holdings.forEach((h, i) => {
            expect(h.price).toBe(100 + i);
        });
    });

    it('보유 종목 하나라도 resolveMarketProfile이 reject하면 tool 호출 전체가 reject된다 (동시성 제한 도입 전과 동일한 실패 시맨틱)', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '1',
                averagePrice: '1',
            },
            {
                symbol: 'BAD',
                companyName: 'Bad',
                quantity: '1',
                averagePrice: '1',
            },
        ]);
        profile.mockImplementation(async (symbol: string) =>
            symbol === 'BAD'
                ? Promise.reject(new Error('profile resolve failed'))
                : 'us-equity'
        );
        getQuote.mockResolvedValue({ price: 100, changesPercentage: 1 });

        await expect(getMyPortfolioTool({}, ctxFor('u1'), rt)).rejects.toThrow(
            'profile resolve failed'
        );
    });
});
