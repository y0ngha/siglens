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
        // Each holding's OWN marketValue rounds to exactly 1 (1.004 → nearest
        // cent → 1.00) — but the group total must be the currency-cent
        // rounding of the RAW sum (2.008 → 2.01), not the sum of the two
        // already-rounded holdings (which would be exactly 2, the
        // double-rounding bug this fix removes).
        getQuote.mockResolvedValue({ price: 1.004, changesPercentage: 0 });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ marketValue: number | null }>;
            totals: Array<{ marketValue: number | null }>;
        };
        expect(r.holdings[0]!.marketValue).toBe(1);
        expect(r.holdings[1]!.marketValue).toBe(1);
        expect(r.totals[0]!.marketValue).toBe(2.01);
        expect(r.totals[0]!.marketValue).not.toBe(2);
    });

    it('MONEY 필드(marketValue/costBasis/pnl)는 유효숫자가 아니라 통화 소수점(센트)으로 반올림된다 — 큰 금액에서도 센트가 유지된다 (실측 회귀)', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '10',
                averagePrice: '250',
            },
            {
                symbol: 'NVDA',
                companyName: 'Nvidia',
                quantity: '20',
                averagePrice: '180',
            },
            {
                symbol: 'TSLA',
                companyName: 'Tesla',
                quantity: '3',
                averagePrice: '400',
            },
            {
                symbol: 'MSFT',
                companyName: 'Microsoft',
                quantity: '4',
                averagePrice: '493.78',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        getQuote.mockImplementation(async (symbol: string) => {
            const price = {
                AAPL: 336.13,
                NVDA: 222.27,
                TSLA: 364.27,
                MSFT: 493.78,
            }[symbol as 'AAPL' | 'NVDA' | 'TSLA' | 'MSFT']!;
            return { price, changesPercentage: 0 };
        });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            totals: Array<{
                currency: string;
                marketValue: number | null;
                costBasis: number;
                pnl: number | null;
            }>;
        };
        const usd = r.totals.find(t => t.currency === 'USD')!;
        expect(usd.marketValue).toBe(10874.63);
        expect(usd.costBasis).toBe(9275.12);
        expect(usd.pnl).toBe(1599.51);
        // value − cost === pnl to the cent (the bug: significant-digit
        // rounding on marketValue alone broke this identity).
        expect(usd.marketValue! - usd.costBasis).toBeCloseTo(usd.pnl!, 2);
    });

    it('큰 금액도 센트를 유지한다 — 유효숫자 방식처럼 십 단위로 뭉개지지 않는다', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '1000',
                averagePrice: '1',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        // quantity(1000) * price = 1234567.891 → marketValue should keep
        // cents (1234567.89), not round to the tens place (1234570) the way
        // 6-significant-digit rounding did.
        getQuote.mockResolvedValue({
            price: 1234.567891,
            changesPercentage: 0,
        });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ marketValue: number | null }>;
        };
        expect(r.holdings[0]!.marketValue).toBe(1234567.89);
    });

    it('KRW 보유 종목의 money 필드는 원 단위(소수점 없음)로 나온다', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: '005930',
                companyName: 'Samsung',
                quantity: '10',
                averagePrice: '123456.78',
            },
        ]);
        profile.mockResolvedValue('kr-equity');
        getQuote.mockResolvedValue({ price: 234567.89, changesPercentage: 0 });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{
                marketValue: number | null;
                costBasis: number;
                pnl: number | null;
            }>;
            totals: Array<{
                marketValue: number | null;
                costBasis: number;
                pnl: number | null;
            }>;
        };
        // Raw amounts (1234567.8 / 2345678.9) carry 8 significant digits, past
        // the old significant-digit rounding's 6-digit precision (it would
        // have rounded to the TENS place: 1234570 / 2345680 / 1111110) — every
        // field here must land on the currency-minor-unit rounding instead.
        expect(r.holdings[0]!.marketValue).toBe(2345679); // 10 * 234567.89, no decimals
        expect(r.holdings[0]!.costBasis).toBe(1234568); // 10 * 123456.78, no decimals
        expect(r.holdings[0]!.pnl).toBe(1111111);
        expect(r.totals[0]!.marketValue).toBe(2345679);
        expect(r.totals[0]!.costBasis).toBe(1234568);
        expect(r.totals[0]!.pnl).toBe(1111111);
    });

    it('costBasis가 .005 반올림 경계에서 float 오차 없이 올림된다 (150.005→150.01, 10.005→10.01)', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '1',
                averagePrice: '150.005',
            },
            {
                symbol: 'MSFT',
                companyName: 'Microsoft',
                quantity: '1',
                averagePrice: '10.005',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        getQuote.mockResolvedValue({ price: 100, changesPercentage: 0 });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ symbol: string; costBasis: number }>;
        };
        // `(150.005).toFixed(2) === '150.00'` (binary-float boundary miss)
        // while `(10.005).toFixed(2) === '10.01'` — both must round UP here.
        expect(r.holdings.find(h => h.symbol === 'AAPL')!.costBasis).toBe(
            150.01
        );
        expect(r.holdings.find(h => h.symbol === 'MSFT')!.costBasis).toBe(
            10.01
        );
    });

    it('pnl이 음의 .005 경계에서도 대칭적으로 -150.01로 반올림된다', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '1',
                averagePrice: '250.005',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        getQuote.mockResolvedValue({ price: 100, changesPercentage: 0 });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ pnl: number | null }>;
        };
        // marketValue(100) - costBasis(250.005) = -150.005 exactly.
        expect(r.holdings[0]!.pnl).toBe(-150.01);
    });

    it('통화 합계 pnl이 부동소수점 잡음으로 0 근처여도 -0/NaN이 아니라 정확히 0이다', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: 'AAPL',
                companyName: 'Apple',
                quantity: '1',
                averagePrice: '100.01',
            },
            {
                symbol: 'MSFT',
                companyName: 'Microsoft',
                quantity: '1',
                averagePrice: '200.02',
            },
        ]);
        profile.mockResolvedValue('us-equity');
        getQuote.mockImplementation(async (symbol: string) =>
            symbol === 'AAPL'
                ? { price: 100.02, changesPercentage: 0 }
                : { price: 200.01, changesPercentage: 0 }
        );

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            totals: Array<{ pnl: number | null }>;
        };
        // costBasisRaw sum (100.01+200.02) and marketValueRaw sum
        // (100.02+200.01) are mathematically equal (300.03) but reach it via
        // different binary-float paths, leaving a ~1e-14 residual —
        // `toBe(0)` uses `Object.is`, which fails on a lingering `-0`.
        expect(r.totals[0]!.pnl).toBe(0);
    });

    it('KRW costBasis도 반올림 경계(0.5원)에서 1235원으로 올림된다', async () => {
        findByUser.mockResolvedValue([
            {
                symbol: '005930',
                companyName: 'Samsung',
                quantity: '1',
                averagePrice: '1234.5',
            },
        ]);
        profile.mockResolvedValue('kr-equity');
        getQuote.mockResolvedValue({ price: 1, changesPercentage: 0 });

        const r = (await getMyPortfolioTool({}, ctxFor('u1'), rt)) as {
            holdings: Array<{ costBasis: number }>;
        };
        expect(r.holdings[0]!.costBasis).toBe(1235);
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
