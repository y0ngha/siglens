import { QUOTE_LOOKUP_TIMEOUT_MS } from '@/shared/api/market/quoteTimeout';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOL_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

const {
    isTabAllowed,
    getProvider,
    resolveMarketProfile,
    getNextEarningsSchedule,
    getQuote,
    assetInfo,
    sessionSpecFor,
    getIncomeStatements,
    getCachedBars,
    listReportedEarningsDates,
    findListedShares,
    fetchDividendSource,
} = vi.hoisted(() => ({
    isTabAllowed: vi.fn(),
    getProvider: vi.fn(),
    resolveMarketProfile: vi.fn(),
    getNextEarningsSchedule: vi.fn(),
    getQuote: vi.fn(),
    assetInfo: vi.fn(),
    sessionSpecFor: vi.fn(),
    getIncomeStatements: vi.fn(),
    getCachedBars: vi.fn(),
    listReportedEarningsDates: vi.fn(),
    findListedShares: vi.fn(),
    fetchDividendSource: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: isTabAllowed,
    findKrListedShares: findListedShares,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile,
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
}));
// `isKrEquitySymbol` is real (via `importOriginal`) — `getFundamentals.ts`
// derives `analystEstimate.period` with the SAME predicate
// `getFundamentalDataProvider` routes on, so a fake here
// would let the two silently diverge without a test ever catching it.
vi.mock('@/shared/config/marketProfile/registry', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/config/marketProfile/registry')
    >()),
    getDescriptor: (id: string) => ({
        priceFormat: { currency: id === 'kr-equity' ? 'KRW' : 'USD' },
    }),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: getProvider,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor,
}));
vi.mock('@/entities/earnings-report/api', () => ({
    getNextEarningsSchedule,
    listReportedEarningsDates,
}));
vi.mock('@/shared/api/fmp/getFinancialStatementsProvider', () => ({
    getFinancialStatementsProvider: () => ({ getIncomeStatements }),
}));
vi.mock('@/entities/bars/lib/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/app/api/ai/chat/tools/dividends', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/app/api/ai/chat/tools/dividends')
    >()),
    fetchDividendSource,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: 'fake-db' }),
}));

import {
    daysUntil,
    earningsDateNoteFor,
    getFundamentalsTool,
} from '@/app/api/ai/chat/tools/getFundamentals';
import {
    FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';

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

function fakeProvider(overrides: Record<string, unknown> = {}) {
    return {
        getProfile: vi.fn().mockResolvedValue({
            symbol: 'AAPL',
            companyName: 'Apple Inc.',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            marketCap: 3_000_000_000_000,
            ceo: null,
            website: null,
            description: null,
        }),
        getKeyMetricsTtm: vi.fn().mockResolvedValue({
            peRatioTTM: 30,
            priceToSalesRatioTTM: 8,
            pbRatioTTM: 40,
            pegRatioTTM: 2,
            enterpriseValueOverEBITDATTM: 22,
            epsTTM: 6.1,
        }),
        getRatiosTtm: vi.fn().mockResolvedValue({
            returnOnEquityTTM: 1.5,
            returnOnAssetsTTM: 0.3,
            operatingProfitMarginTTM: 0.3,
            netProfitMarginTTM: 0.25,
            debtRatioTTM: 0.8,
            currentRatioTTM: 1.0,
        }),
        getIncomeStatementGrowth: vi
            .fn()
            .mockResolvedValue({ growthRevenue: 0.08, growthEPS: 0.1 }),
        getFinancialScores: vi
            .fn()
            .mockResolvedValue({ altmanZScore: 8, piotroskiScore: 7 }),
        getCashFlowStatement: vi
            .fn()
            .mockResolvedValue({ operatingCashFlow: 1_000_000 }),
        getGradesConsensus: vi.fn().mockResolvedValue({
            strongBuy: 10,
            buy: 20,
            hold: 5,
            sell: 1,
            strongSell: 0,
        }),
        getPriceTargetConsensus: vi.fn().mockResolvedValue({
            targetHigh: 300,
            targetLow: 200,
            targetMedian: 250,
            targetConsensus: 245,
        }),
        getAnalystEstimates: vi.fn().mockResolvedValue({
            estimatedEpsAvg: 2,
            estimatedRevenueAvg: 1e11,
        }),
        ...overrides,
    };
}

describe('getFundamentalsTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isTabAllowed.mockResolvedValue(true);
        resolveMarketProfile.mockResolvedValue('us-equity');
        getNextEarningsSchedule.mockResolvedValue(null);
        getQuote.mockResolvedValue({ price: 200, changesPercentage: 1 });
        assetInfo.mockResolvedValue(null);
        getIncomeStatements.mockResolvedValue([]);
        getCachedBars.mockResolvedValue({ bars: [], indicators: {} });
        listReportedEarningsDates.mockResolvedValue([]);
        findListedShares.mockResolvedValue(null);
        fetchDividendSource.mockResolvedValue(null);
        sessionSpecFor.mockReturnValue({
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 570,
            closeMinute: 960,
            weekendDays: [0, 6],
        });
    });

    it('크립토 등 fundamental 탭이 없는 심볼은 프로바이더 호출 없이 available:false', async () => {
        isTabAllowed.mockResolvedValue(false);
        const r = await getFundamentalsTool({ symbol: 'BTCUSD' }, ctx, rt);
        expect(r).toEqual({
            symbol: 'BTCUSD',
            available: false,
            reason: 'tab_not_available',
        });
        expect(getProvider).not.toHaveBeenCalled();
    });

    it('profile이 없으면 available:false (no_profile)', async () => {
        const provider = fakeProvider({
            getProfile: vi.fn().mockResolvedValue(null),
        });
        getProvider.mockReturnValue(provider);
        const r = await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt);
        expect(r).toEqual({
            symbol: 'AAPL',
            available: false,
            reason: 'no_profile',
        });
    });

    it('한국 종목의 죽은 리스팅(시세가 14일 넘게 멈춤)은 묵은 가격 대신 stale_listing으로 돌린다', async () => {
        resolveMarketProfile.mockResolvedValue('kr-equity');
        getProvider.mockReturnValue(fakeProvider());
        getQuote.mockResolvedValue({
            price: 40100,
            changesPercentage: 0,
            timestamp: Math.floor(Date.UTC(2024, 6, 19, 6, 30) / 1000),
        });
        const r = await getFundamentalsTool({ symbol: '253450.KS' }, ctx, rt);
        expect(r).toEqual({
            symbol: '253450.KS',
            available: false,
            error: 'stale_listing',
            lastTradeDate: '2024-07-19',
        });
    });

    it('한국 종목이라도 최근 시세면 정상 투영한다', async () => {
        resolveMarketProfile.mockResolvedValue('kr-equity');
        getProvider.mockReturnValue(fakeProvider());
        getQuote.mockResolvedValue({
            price: 23550,
            changesPercentage: 0,
            timestamp: Math.floor(Date.now() / 1000),
        });
        const r = (await getFundamentalsTool(
            { symbol: '253450.KQ' },
            ctx,
            rt
        )) as { available: boolean; price: number };
        expect(r.available).toBe(true);
        expect(r.price).toBe(23550);
    });

    describe('한국 종목 시총·PER·PBR (KRX 상장주식수 기준)', () => {
        const dayBar = (iso: string, close: number) => ({
            time: Date.parse(`${iso}T00:00:00Z`) / 1000,
            open: close,
            high: close,
            low: close,
            close,
            volume: 1,
        });
        const krProvider = () =>
            fakeProvider({
                getProfile: vi.fn().mockResolvedValue({
                    symbol: '010140.KS',
                    companyName: 'Samsung Heavy Industries',
                    sector: 'Industrials',
                    industry: 'Shipbuilding',
                    // yahoo 시총 14.375조 (≈ 8.54억 주 기준)
                    marketCap: 14_375_000_000_000,
                    ceo: null,
                    website: null,
                    description: null,
                }),
                getKeyMetricsTtm: vi.fn().mockResolvedValue({
                    peRatioTTM: 20,
                    priceToSalesRatioTTM: 1,
                    pbRatioTTM: 4,
                    pegRatioTTM: null,
                    enterpriseValueOverEBITDATTM: 9,
                    epsTTM: 800,
                }),
            });
        type KrResult = {
            profile: {
                marketCap: number;
                sharesBasis: string;
                sharesOutstanding: number | null;
                marketCapCloseDate: string | null;
            };
            valuation: {
                pe: number;
                pb: number;
                ps: number;
                evToEbitda: number | null;
            };
        };

        beforeEach(() => {
            resolveMarketProfile.mockResolvedValue('kr-equity');
            getProvider.mockReturnValue(krProvider());
            getQuote.mockResolvedValue({
                price: 16830,
                changesPercentage: 0,
                timestamp: Math.floor(Date.now() / 1000),
            });
            getCachedBars.mockResolvedValue({
                bars: [
                    dayBar('2026-10-22', 16500),
                    dayBar('2026-10-23', 16830),
                ],
                indicators: {},
            });
        });

        it('상장주식수 × 직전 완료 종가로 시총을 내고 PER·PBR을 같은 비율로 맞춘다', async () => {
            findListedShares.mockResolvedValue(880_000_000);
            const r = (await getFundamentalsTool(
                { symbol: '010140.KS' },
                ctx,
                rt
            )) as KrResult;
            expect(findListedShares).toHaveBeenCalledWith(
                '010140.KS',
                'fake-db'
            );
            expect(r.profile).toMatchObject({
                marketCap: 14_810_400_000_000,
                sharesBasis: 'krx_listed',
                sharesOutstanding: 880_000_000,
                marketCapCloseDate: '2026-10-23',
            });
            const scale = 14_810_400_000_000 / 14_375_000_000_000;
            expect(r.valuation.pe).toBeCloseTo(20 * scale, 4);
            expect(r.valuation.pb).toBeCloseTo(4 * scale, 4);
            expect(r.valuation.ps).toBeCloseTo(1 * scale, 4);
            // EV includes net debt; not recomputable from market cap alone.
            expect(r.valuation.evToEbitda).toBeNull();
        });

        it('정규장이 열려 마지막 봉이 진행 중이면 직전 완료 봉의 종가를 쓴다', async () => {
            vi.useFakeTimers();
            // 2026-10-23 10:00 KST — 정규장 중, 마지막 봉은 오늘 봉(라이브).
            vi.setSystemTime(new Date('2026-10-23T01:00:00.000Z'));
            try {
                sessionSpecFor.mockReturnValue({
                    kind: 'scheduled',
                    timeZone: 'Asia/Seoul',
                    openMinute: 540,
                    closeMinute: 930,
                    weekendDays: [0, 6],
                });
                findListedShares.mockResolvedValue(880_000_000);
                getCachedBars.mockResolvedValue({
                    bars: [
                        dayBar('2026-10-22', 16500),
                        dayBar('2026-10-23', 99999),
                    ],
                    indicators: {},
                });
                const r = (await getFundamentalsTool(
                    { symbol: '010140.KS' },
                    ctx,
                    rt
                )) as KrResult;
                expect(r.profile.marketCap).toBe(880_000_000 * 16500);
                expect(r.profile.marketCapCloseDate).toBe('2026-10-22');
            } finally {
                vi.useRealTimers();
            }
        });

        it('상장주식수가 없으면 프로바이더 값 그대로 두고 provider로 표시한다', async () => {
            findListedShares.mockResolvedValue(null);
            const r = (await getFundamentalsTool(
                { symbol: '010140.KS' },
                ctx,
                rt
            )) as KrResult;
            expect(r.profile).toMatchObject({
                marketCap: 14_375_000_000_000,
                sharesBasis: 'provider',
                sharesOutstanding: null,
                marketCapCloseDate: null,
            });
            expect(r.valuation).toMatchObject({
                pe: 20,
                pb: 4,
                ps: 1,
                evToEbitda: 9,
            });
        });

        it('상장주식수 조회가 던져도 도구는 provider 기준으로 계속된다', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const consoleWarnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            try {
                findListedShares.mockRejectedValue(new Error('db down'));
                const r = (await getFundamentalsTool(
                    { symbol: '010140.KS' },
                    ctx,
                    rt
                )) as KrResult;
                expect(r.profile.sharesBasis).toBe('provider');
                expect(r.profile.marketCap).toBe(14_375_000_000_000);
            } finally {
                consoleErrorSpy.mockRestore();
                consoleWarnSpy.mockRestore();
            }
        });

        it('일봉 로드가 실패하면 provider로 폴백한다', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const consoleWarnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            try {
                findListedShares.mockResolvedValue(880_000_000);
                getCachedBars.mockRejectedValue(new Error('yahoo down'));
                const r = (await getFundamentalsTool(
                    { symbol: '010140.KS' },
                    ctx,
                    rt
                )) as KrResult;
                expect(r.profile.sharesBasis).toBe('provider');
            } finally {
                consoleErrorSpy.mockRestore();
                consoleWarnSpy.mockRestore();
            }
        });

        it('미국 종목은 상장주식수 조회도 새 필드도 없다', async () => {
            resolveMarketProfile.mockResolvedValue('us-equity');
            getProvider.mockReturnValue(fakeProvider());
            const r = (await getFundamentalsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as { profile: Record<string, unknown> };
            expect(findListedShares).not.toHaveBeenCalled();
            expect(r.profile).not.toHaveProperty('sharesBasis');
        });
    });

    it('전 섹션이 채워지면 통화·밸류에이션·헬스·애널리스트를 투영한다', async () => {
        getProvider.mockReturnValue(fakeProvider());
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            available: boolean;
            price: number | null;
            profile: { currency: string; name: string };
            valuation: { pe: number };
            health: { altmanZScore: number; operatingCashFlow: number };
            analyst: { consensus: { strongBuy: number } };
        };
        expect(r.available).toBe(true);
        expect(r.price).toBe(200);
        expect(r.profile).toEqual({
            name: 'Apple Inc.',
            sector: 'Technology',
            industry: 'Consumer Electronics',
            marketCap: 3_000_000_000_000,
            currency: 'USD',
        });
        expect(r.valuation.pe).toBe(30);
        expect(r.health.altmanZScore).toBe(8);
        expect(r.health.operatingCashFlow).toBe(1_000_000);
        expect(r.analyst.consensus.strongBuy).toBe(10);
    });

    it('profitability/growth 필드는 FMP 소수(0.25=25%)를 ×100 해 ...Pct로 명명한다 (spec §3.4, B6) — debtRatio/currentRatio/pe/pb/ps는 배율 그대로 유지', async () => {
        getProvider.mockReturnValue(fakeProvider());
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            profitability: {
                roePct: number;
                roaPct: number;
                operatingMarginPct: number;
                netMarginPct: number;
            };
            growth: { revenueGrowthPct: number; epsGrowthPct: number };
            health: { debtRatio: number; currentRatio: number };
            valuation: { pe: number; pb: number; ps: number };
        };
        expect(r.profitability).toEqual({
            roePct: 150, // 1.5 * 100
            roaPct: 30, // 0.3 * 100
            operatingMarginPct: 30,
            netMarginPct: 25,
        });
        expect(r.growth).toEqual({
            revenueGrowthPct: 8, // 0.08 * 100
            epsGrowthPct: 10,
        });
        // Unconverted — the widget displays these as plain multiples, no `* 100`.
        expect(r.health.debtRatio).toBe(0.8);
        expect(r.health.currentRatio).toBe(1.0);
        expect(r.valuation).toEqual({ pe: 30, pb: 40, ps: 8, evToEbitda: 22 });
    });

    it('targetUpsidePct/analystBuySharePct/daysToEarnings을 계산하고, epsEstimateVsTtmPct는 존재하지 않는다 (spec §3.4, B6 — period 불일치로 제거됨)', async () => {
        getProvider.mockReturnValue(fakeProvider());
        getQuote.mockResolvedValue({ price: 200, changesPercentage: 1 });
        getNextEarningsSchedule.mockResolvedValue({
            symbol: 'AAPL',
            earningsDate: '2026-10-30',
            epsActual: null,
            epsEstimated: 1.5,
            revenueActual: null,
            revenueEstimated: 1e11,
            lastUpdated: '2026-09-01T00:00:00.000Z',
        });
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            analyst: {
                targetUpsidePct: number | null;
                analystBuySharePct: number | null;
                daysToEarnings: number | null;
                analystEstimate: unknown;
            };
        };
        // targetConsensus=245 vs price=200
        expect(r.analyst.targetUpsidePct).toBeCloseTo(
            ((245 - 200) / 200) * 100,
            4
        );
        // (strongBuy 10 + buy 20) / total 36 * 100
        expect(r.analyst.analystBuySharePct).toBeCloseTo((30 / 36) * 100, 4);
        expect(typeof r.analyst.daysToEarnings).toBe('number');
        // The raw estimate is still surfaced — just never turned into a
        // computed vs-TTM percent (unknown fiscal period on both sides).
        // labelled with the period it covers (US: fiscal year in progress).
        expect(r.analyst.analystEstimate).toEqual({
            estimatedEpsAvg: 2,
            estimatedRevenueAvg: 1e11,
            period: 'current_fiscal_year',
        });
        expect(r.analyst).not.toHaveProperty('nextQuarterEstimate');
        expect(r.analyst).not.toHaveProperty('epsEstimateVsTtmPct');
    });

    describe('daysUntil (spec §0 null rule, market-timezone calendar-day diff)', () => {
        // 2026-09-18T18:00:00Z = 2026-09-18T14:00:00 ET (EDT, UTC-4) —
        // firmly inside the US session, not near the UTC/ET date boundary.
        const nowUsSession = new Date('2026-09-18T18:00:00.000Z');
        it('normal: 미래 날짜는 양수', () => {
            expect(daysUntil('2026-10-30', nowUsSession)).toBe(42);
        });
        it('zero: 오늘 날짜는 0', () => {
            expect(daysUntil('2026-09-18', nowUsSession)).toBe(0);
        });
        it('negative: 과거 날짜는 음수', () => {
            expect(daysUntil('2026-09-01', nowUsSession)).toBe(-17);
        });
        it('invalid date string → null', () => {
            expect(daysUntil('not-a-date', nowUsSession)).toBeNull();
        });
        it('null 입력 → null', () => {
            expect(daysUntil(null, nowUsSession)).toBeNull();
        });
        it('earnings 내일(ET) → 1: UTC 자정 기준 raw ms 반올림이면 0으로 잘못 나올 시각', () => {
            // 2026-09-18T21:00:00Z = 2026-09-18T17:00:00 ET — still 9/18 ET,
            // under 7h of raw ms before a UTC-midnight-parsed 9/19 target,
            // so naive `(target-now)/MS_PER_DAY` rounding would floor to 0
            // (today) instead of the correct 1 (tomorrow, ET calendar days).
            const lateAfternoonEt = new Date('2026-09-18T21:00:00.000Z');
            expect(daysUntil('2026-09-19', lateAfternoonEt)).toBe(1);
        });
        it('KR 종목(KST): timeZone 인자로 한국 거래일 기준 diff를 계산한다', () => {
            // 2026-09-18T00:30:00Z = 2026-09-18T09:30:00 KST (UTC+9) — KST
            // calendar date is 9/18, even though the raw UTC instant is
            // still technically "before" a naive UTC-midnight comparison
            // would expect for "today".
            const kstMorning = new Date('2026-09-18T00:30:00.000Z');
            expect(daysUntil('2026-09-18', kstMorning, 'Asia/Seoul')).toBe(0);
            expect(daysUntil('2026-09-19', kstMorning, 'Asia/Seoul')).toBe(1);
        });

        it('US: 2026-09-19T02:00Z(=9/18 22:00 ET)에 earnings가 9/19면 1 — UTC 날짜 산술이면 0이 나올 시각', () => {
            // target='2026-09-19' (UTC midnight). now=2026-09-19T02:00Z is
            // AFTER that UTC midnight, so a naive `(target-now)/MS_PER_DAY`
            // rounds to 0 (or negative) — but ET wall-clock is still 9/18
            // 22:00 the PREVIOUS calendar day, so the correct earnings-days
            // answer is 1 (tomorrow, ET calendar terms).
            const now = new Date('2026-09-19T02:00:00.000Z');
            expect(daysUntil('2026-09-19', now)).toBe(1);
        });

        it('KR: 2026-09-18T16:00Z(=9/19 01:00 KST)에 earnings가 9/19면 0', () => {
            const now = new Date('2026-09-18T16:00:00.000Z');
            expect(daysUntil('2026-09-19', now, 'Asia/Seoul')).toBe(0);
        });
    });

    it('daysToEarnings (tool-level): KR 종목은 sessionSpecFor가 돌려주는 KST 세션으로 계산한다 — America/New_York를 하드코딩하면 0 대신 1이 나올 시각', async () => {
        // 2026-09-19T02:00Z = 2026-09-18T22:00 ET (previous ET day) but
        // 2026-09-19T11:00 KST (SAME day as the 9/19 earnings date) — a
        // hardcoded 'America/New_York' would answer 1 (tomorrow, wrong for
        // a KR listing); deriving the timezone from `sessionSpecFor`'s KST
        // session answers the correct 0 (today).
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-19T02:00:00.000Z'));
        try {
            resolveMarketProfile.mockResolvedValue('kr-equity');
            sessionSpecFor.mockReturnValue({
                kind: 'scheduled',
                timeZone: 'Asia/Seoul',
                openMinute: 540,
                closeMinute: 930,
                weekendDays: [0, 6],
            });
            getProvider.mockReturnValue(fakeProvider());
            getQuote.mockResolvedValue({ price: 200, changesPercentage: 1 });
            getNextEarningsSchedule.mockResolvedValue({
                symbol: '005930.KS',
                earningsDate: '2026-09-19',
                epsActual: null,
                epsEstimated: 1.5,
                revenueActual: null,
                revenueEstimated: 1e11,
                lastUpdated: '2026-09-01T00:00:00.000Z',
            });

            const r = (await getFundamentalsTool(
                { symbol: '005930.KS' },
                ctx,
                rt
            )) as { analyst: { daysToEarnings: number | null } };
            expect(r.analyst.daysToEarnings).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('quote/analyst 입력이 없으면(null rule) price/targetUpsidePct/analystBuySharePct/daysToEarnings 전부 null', async () => {
        getProvider.mockReturnValue(
            fakeProvider({
                getGradesConsensus: vi.fn().mockResolvedValue(null),
                getPriceTargetConsensus: vi.fn().mockResolvedValue(null),
                getAnalystEstimates: vi.fn().mockResolvedValue(null),
            })
        );
        getQuote.mockRejectedValue(new Error('fmp down'));
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            price: number | null;
            analyst: {
                targetUpsidePct: number | null;
                analystBuySharePct: number | null;
                daysToEarnings: number | null;
            };
        };
        expect(r.price).toBeNull();
        expect(r.analyst.targetUpsidePct).toBeNull();
        expect(r.analyst.analystBuySharePct).toBeNull();
        expect(r.analyst.daysToEarnings).toBeNull();
    });

    it('a quote that never settles is bounded by QUOTE_LOOKUP_TIMEOUT_MS — the tool still answers, with price null', async () => {
        vi.useFakeTimers();
        try {
            getProvider.mockReturnValue(fakeProvider());
            getQuote.mockReturnValue(new Promise(() => {}));
            const pending = getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt);
            await vi.advanceTimersByTimeAsync(QUOTE_LOOKUP_TIMEOUT_MS);
            const r = (await pending) as {
                available: boolean;
                price: number | null;
                analyst: { targetUpsidePct: number | null };
            };
            expect(r.available).toBe(true);
            expect(r.price).toBeNull();
            expect(r.analyst.targetUpsidePct).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('price가 0 이하면(잘못된 상류 데이터) null 취급한다', async () => {
        getProvider.mockReturnValue(fakeProvider());
        getQuote.mockResolvedValue({ price: 0, changesPercentage: 0 });
        let r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            price: number | null;
        };
        expect(r.price).toBeNull();

        getQuote.mockResolvedValue({ price: -50, changesPercentage: 1 });
        r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            price: number | null;
        };
        expect(r.price).toBeNull();
    });

    it('fmpSymbol이 있으면(get_quote와 같은 경로) 시세를 그 값으로 조회한다', async () => {
        getProvider.mockReturnValue(fakeProvider());
        assetInfo.mockResolvedValue({
            symbol: '^SPX',
            fmpSymbol: '^GSPC',
        });
        await getFundamentalsTool({ symbol: '^SPX' }, ctx, rt);
        expect(getQuote).toHaveBeenCalledWith('^GSPC');
    });

    it('밸류에이션 조회가 실패해도(allSettled) 프로필·다른 섹션은 살아남는다', async () => {
        const provider = fakeProvider({
            getKeyMetricsTtm: vi.fn().mockRejectedValue(new Error('fmp 500')),
        });
        getProvider.mockReturnValue(provider);
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            available: boolean;
            valuation: unknown;
            growth: unknown;
        };
        expect(r.available).toBe(true);
        expect(r.valuation).toBeNull();
        expect(r.growth).not.toBeNull();
    });

    it('다음 실적일이 있으면 analyst.nextEarningsDate에 실린다 — DB 캐시 로더를 심볼·db로 호출', async () => {
        getProvider.mockReturnValue(fakeProvider());
        getNextEarningsSchedule.mockResolvedValue({
            symbol: 'AAPL',
            earningsDate: '2026-10-30',
            epsActual: null,
            epsEstimated: 1.5,
            revenueActual: null,
            revenueEstimated: 1e11,
            lastUpdated: '2026-09-01T00:00:00.000Z',
        });
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            analyst: { nextEarningsDate: string | null };
        };
        expect(r.analyst.nextEarningsDate).toBe('2026-10-30');
        // Reuses the shared DB-backed cached loader (entities/earnings-report)
        // rather than an uncached provider call — this is the assertion that
        // fails if the caching wrapper is dropped.
        expect(getNextEarningsSchedule).toHaveBeenCalledWith('AAPL', 'fake-db');
    });

    it.each([
        [
            true,
            'Date confirmed by the provider. Session timing (before/after market) is not provided by the data source; use web_search to find the timing the company announced and cite the source, never guess.',
        ],
        [
            false,
            'Provider marks this date as an estimate; it may move. Session timing (before/after market) is not provided by the data source; use web_search to find the timing the company announced and cite the source, never guess.',
        ],
        [
            null,
            'Provider gives no confirmation flag, so treat this as a scheduled date that may move. Session timing (before/after market) is not provided by the data source; use web_search to find the timing the company announced and cite the source, never guess.',
        ],
    ])(
        '실적일 확정 여부(%s)와 발표 시각 미제공을 출력에 명시한다 — 예정일을 확정처럼 읽지 않게',
        async (dateConfirmed, note) => {
            getProvider.mockReturnValue(fakeProvider());
            getNextEarningsSchedule.mockResolvedValue({
                symbol: 'COP',
                earningsDate: '2026-11-05',
                epsActual: null,
                epsEstimated: 1.4,
                revenueActual: null,
                revenueEstimated: null,
                lastUpdated: '2026-10-21',
                dateConfirmed,
            });
            const r = (await getFundamentalsTool(
                { symbol: 'COP' },
                ctx,
                rt
            )) as {
                analyst: {
                    earningsDateConfirmed: boolean | null;
                    earningsDateNote: string;
                };
            };
            expect(r.analyst.earningsDateConfirmed).toBe(dateConfirmed);
            expect(r.analyst.earningsDateNote).toBe(note);
        }
    );

    it('다음 실적일이 없으면 확정 여부·안내 필드를 싣지 않는다', async () => {
        getProvider.mockReturnValue(fakeProvider());
        getNextEarningsSchedule.mockResolvedValue(null);
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            analyst: Record<string, unknown>;
        };
        expect(r.analyst).not.toHaveProperty('earningsDateConfirmed');
        expect(r.analyst).not.toHaveProperty('earningsDateNote');
    });

    it('실적일 조회가 실패해도(allSettled) 나머지 섹션은 살아남고 nextEarningsDate는 null', async () => {
        getProvider.mockReturnValue(fakeProvider());
        getNextEarningsSchedule.mockRejectedValue(new Error('db down'));
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            available: boolean;
            analyst: { nextEarningsDate: string | null; consensus: unknown };
        };
        expect(r.available).toBe(true);
        expect(r.analyst.nextEarningsDate).toBeNull();
        expect(r.analyst.consensus).not.toBeNull();
    });

    describe('recentQuarters (dev-2026-10-22 A6)', () => {
        const incomeRow = (
            date: string,
            period: string,
            extra: Record<string, unknown> = {}
        ) => ({
            fiscalYear: '2026',
            period,
            date,
            reportedCurrency: 'USD',
            revenue: 2_440_000_000,
            grossProfit: null,
            operatingIncome: null,
            netIncome: null,
            ebitda: null,
            eps: 5.7,
            epsDiluted: 5.58,
            grossMargin: null,
            operatingMargin: null,
            netMargin: null,
            ...extra,
        });

        it("reads the financials tab's cached quarterly income rows, newest first", async () => {
            getProvider.mockReturnValue(fakeProvider());
            getIncomeStatements.mockResolvedValue([
                incomeRow('2026-04-03', 'Q3', { filingDate: '2026-04-29' }),
                incomeRow('2026-07-03', 'Q4', { filingDate: '2026-08-01' }),
            ]);
            const r = (await getFundamentalsTool(
                { symbol: 'STX' },
                ctx,
                rt
            )) as {
                recentQuarters: unknown[] | null;
            };
            expect(getIncomeStatements).toHaveBeenCalledWith(
                'STX',
                'quarter',
                9
            );
            expect(r.recentQuarters).toEqual([
                {
                    periodEnd: '2026-07-03',
                    fiscalYear: '2026',
                    period: 'Q4',
                    form: '10-K',
                    filingDate: '2026-08-01',
                    epsDiluted: 5.58,
                    revenue: 2_440_000_000,
                    revenueYoYPct: null,
                    currency: 'USD',
                },
                {
                    periodEnd: '2026-04-03',
                    fiscalYear: '2026',
                    period: 'Q3',
                    form: '10-Q',
                    filingDate: '2026-04-29',
                    epsDiluted: 5.58,
                    revenue: 2_440_000_000,
                    revenueYoYPct: null,
                    currency: 'USD',
                },
            ]);
        });

        it.each([
            ['USD', { reportedCurrency: 'USD' }],
            ['absent', { reportedCurrency: undefined }],
        ])(
            'a Korean stock gets form: null even when the row currency is %s (only the KR-symbol wiring can cause it)',
            async (_label, extra) => {
                getProvider.mockReturnValue(fakeProvider());
                getIncomeStatements.mockResolvedValue([
                    incomeRow('2026-06-30', 'Q2', extra),
                ]);
                const r = (await getFundamentalsTool(
                    { symbol: '005930.KS' },
                    ctx,
                    rt
                )) as { recentQuarters: { form: unknown }[] | null };
                expect(r.recentQuarters?.[0]?.form).toBeNull();
            }
        );

        it('the same USD row for a US symbol keeps the derived form (control)', async () => {
            getProvider.mockReturnValue(fakeProvider());
            getIncomeStatements.mockResolvedValue([
                incomeRow('2026-06-30', 'Q2', { reportedCurrency: 'USD' }),
            ]);
            const r = (await getFundamentalsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as { recentQuarters: { form: unknown }[] | null };
            expect(r.recentQuarters?.[0]?.form).toBe('10-Q');
        });

        it('no quarterly rows (or a failed read) → null, other sections intact', async () => {
            getProvider.mockReturnValue(fakeProvider());
            getIncomeStatements.mockRejectedValue(new Error('fmp down'));
            const r = (await getFundamentalsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as {
                recentQuarters: unknown;
                valuation: unknown;
            };
            expect(r.recentQuarters).toBeNull();
            expect(r.valuation).not.toBeNull();
        });
    });

    describe('earningsReactions (dev-2026-10-22 A12)', () => {
        const bar = (date: string, close: number) => ({
            time: Date.parse(`${date}T00:00:00Z`) / 1000,
            open: close,
            high: close,
            low: close,
            close,
            volume: 1,
        });

        it('measures each reported date from the daily bars, after the earnings refresh settles', async () => {
            getProvider.mockReturnValue(fakeProvider());
            assetInfo.mockResolvedValue({ symbol: 'MSI', fmpSymbol: 'MSI' });
            const order: string[] = [];
            getNextEarningsSchedule.mockImplementation(async () => {
                order.push('refresh');
                return null;
            });
            listReportedEarningsDates.mockImplementation(async () => {
                order.push('read');
                return ['2026-07-30', '2026-04-30'];
            });
            getCachedBars.mockResolvedValue({
                bars: [
                    bar('2026-04-29', 400),
                    bar('2026-04-30', 380),
                    bar('2026-05-01', 420),
                    bar('2026-07-29', 450),
                    bar('2026-07-30', 455),
                    bar('2026-07-31', 441),
                ],
                indicators: {},
            });
            const r = (await getFundamentalsTool(
                { symbol: 'MSI' },
                ctx,
                rt
            )) as {
                earningsReactions: unknown;
            };
            expect(r.earningsReactions).toEqual([
                { date: '2026-07-30', movePct: -2 },
                { date: '2026-04-30', movePct: 5 },
            ]);
            expect(order).toEqual(['refresh', 'read']);
            expect(listReportedEarningsDates).toHaveBeenCalledWith(
                'MSI',
                'fake-db'
            );
            const [, symbol, timeframe, fmpSymbol] =
                getCachedBars.mock.calls.find(c => c[2] === '1Day')!;
            expect([symbol, timeframe, fmpSymbol]).toEqual([
                'MSI',
                '1Day',
                'MSI',
            ]);
        });

        it("skips a report whose next session is today's live bar, and keeps it once that session closed", async () => {
            const { US_EQUITY_SESSION } = await vi.importActual<
                typeof import('@y0ngha/siglens-core')
            >('@y0ngha/siglens-core');
            sessionSpecFor.mockReturnValue(US_EQUITY_SESSION);
            getProvider.mockReturnValue(fakeProvider());
            // After-close report on Mon 08-03; Tue 08-04 is the live bar mid-session.
            listReportedEarningsDates.mockResolvedValue([
                '2026-08-03',
                '2026-07-31',
            ]);
            getCachedBars.mockResolvedValue({
                bars: [
                    bar('2026-07-30', 90),
                    bar('2026-07-31', 100),
                    bar('2026-08-03', 110),
                    bar('2026-08-04', 130),
                ],
                indicators: {},
            });
            vi.useFakeTimers({ toFake: ['Date'] });
            try {
                vi.setSystemTime(new Date('2026-08-04T15:00:00Z')); // 11:00 ET
                const open = (await getFundamentalsTool(
                    { symbol: 'MSI' },
                    ctx,
                    rt
                )) as { earningsReactions: unknown };
                expect(open.earningsReactions).toEqual([
                    { date: '2026-07-31', movePct: 22.2222 },
                ]);

                vi.setSystemTime(new Date('2026-08-04T21:00:00Z')); // 17:00 ET
                const closed = (await getFundamentalsTool(
                    { symbol: 'MSI' },
                    ctx,
                    rt
                )) as { earningsReactions: unknown };
                expect(closed.earningsReactions).toEqual([
                    { date: '2026-08-03', movePct: 30 },
                    { date: '2026-07-31', movePct: 22.2222 },
                ]);
            } finally {
                vi.useRealTimers();
            }
        });

        it('a failed bars load degrades to null without failing the tool', async () => {
            getProvider.mockReturnValue(fakeProvider());
            listReportedEarningsDates.mockResolvedValue(['2026-07-30']);
            getCachedBars.mockRejectedValue(new Error('bars down'));
            const r = (await getFundamentalsTool(
                { symbol: 'MSI' },
                ctx,
                rt
            )) as {
                available: boolean;
                earningsReactions: unknown;
            };
            expect(r.available).toBe(true);
            expect(r.earningsReactions).toBeNull();
        });

        it('a failed refresh still reads the reported dates already in the DB', async () => {
            getProvider.mockReturnValue(fakeProvider());
            getNextEarningsSchedule.mockRejectedValue(new Error('fmp down'));
            listReportedEarningsDates.mockResolvedValue(['2026-07-30']);
            getCachedBars.mockResolvedValue({
                bars: [
                    bar('2026-07-29', 100),
                    bar('2026-07-30', 90),
                    bar('2026-07-31', 110),
                ],
                indicators: {},
            });
            const r = (await getFundamentalsTool(
                { symbol: 'MSI' },
                ctx,
                rt
            )) as {
                earningsReactions: unknown;
            };
            expect(r.earningsReactions).toEqual([
                { date: '2026-07-30', movePct: 10 },
            ]);
        });
    });

    it('with 5 quarters and 8 reactions the result still fits the shared tool budget', async () => {
        getProvider.mockReturnValue(fakeProvider());
        getIncomeStatements.mockResolvedValue(
            Array.from({ length: 8 }, (_, i) => ({
                fiscalYear: '2026',
                period: `Q${(i % 4) + 1}`,
                date: `2026-0${(i % 9) + 1}-28`,
                filingDate: '2026-10-01',
                reportedCurrency: 'USD',
                revenue: 123_456_789_012,
                grossProfit: null,
                operatingIncome: null,
                netIncome: null,
                ebitda: null,
                eps: 12.3456,
                epsDiluted: 12.3456,
                grossMargin: null,
                operatingMargin: null,
                netMargin: null,
            }))
        );
        const days = Array.from({ length: 400 }, (_, i) =>
            new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)
        );
        getCachedBars.mockResolvedValue({
            bars: days.map((d, i) => ({
                time: Date.parse(`${d}T00:00:00Z`) / 1000,
                open: 1,
                high: 1,
                low: 1,
                close: 100 + i * 1.2345,
                volume: 1,
            })),
            indicators: {},
        });
        listReportedEarningsDates.mockResolvedValue(
            days.filter((_, i) => i % 40 === 20)
        );
        fetchDividendSource.mockResolvedValue({
            kind: 'fmp',
            rows: [
                { exDate: '2026-08-10', amount: 0.27, payDate: '2026-08-13' },
                { exDate: '2026-05-11', amount: 0.26, payDate: '2026-05-14' },
            ],
        });
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            recentQuarters: unknown[];
            earningsReactions: unknown[];
            dividends: unknown;
        };
        expect(r.dividends).not.toBeNull();
        expect(r.recentQuarters).toHaveLength(5);
        expect(r.earningsReactions).toHaveLength(8);
        expect(JSON.stringify(r).length).toBeLessThan(TOOL_RESULT_MAX_CHARS);
    });

    it('한국 종목은 KRW 통화로 투영된다', async () => {
        resolveMarketProfile.mockResolvedValue('kr-equity');
        getProvider.mockReturnValue(fakeProvider());
        const r = (await getFundamentalsTool(
            { symbol: '005930.KS' },
            ctx,
            rt
        )) as {
            profile: { currency: string };
            analyst: { analystEstimate: { period: string } | null };
        };
        expect(r.profile.currency).toBe('KRW');
        // The Korean provider (Yahoo) reports the CURRENT QUARTER consensus.
        expect(r.analyst.analystEstimate?.period).toBe('current_quarter');
    });
});

describe('펀더멘털 나이 표기', () => {
    /**
     * 이 경로는 24시간 캐시를 읽으므로 `asOf: now`만 내보내면 모델이 "지금 P/E"라고
     * 단정할 근거를 준다. 지연 자체가 아니라 **지연을 숨기는 것**이 문제다.
     * (변이 검증: 이 단언이 없으면 두 필드를 지워도 전 스위트 초록이었다.)
     */
    it('조회 시각임을 밝히고 캐시 섹션의 나이 상한을 함께 싣는다', async () => {
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            asOfIsFetchTime?: boolean;
            cachedSectionsMaxAgeHours?: number;
        };

        expect(r.asOfIsFetchTime).toBe(true);
        // 상한은 펀더멘털 캐시 TTL에서 파생된다 — 리터럴을 복제하면 TTL이 바뀌어도
        // 테스트가 같이 바뀌어 아무것도 못 잡는다.
        // FMP 응답은 Redis 한 계층에만 묵으므로 그 TTL이 곧 상한이다.
        expect(r.cachedSectionsMaxAgeHours).toBe(
            FMP_FUNDAMENTAL_CACHE_TTL_SECONDS / SECONDS_PER_HOUR
        );
    });
});

describe('getFundamentalsTool dividends wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchDividendSource.mockResolvedValue(null);
        isTabAllowed.mockResolvedValue(true);
        resolveMarketProfile.mockResolvedValue('us-equity');
        getNextEarningsSchedule.mockResolvedValue(null);
        getQuote.mockResolvedValue({ price: 200, changesPercentage: 1 });
        assetInfo.mockResolvedValue(null);
        getIncomeStatements.mockResolvedValue([]);
        getCachedBars.mockResolvedValue({ bars: [], indicators: {} });
        listReportedEarningsDates.mockResolvedValue([]);
        sessionSpecFor.mockReturnValue({
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 570,
            closeMinute: 960,
            weekendDays: [0, 6],
        });
        getProvider.mockReturnValue(fakeProvider());
    });

    it('미국 심볼: 원자료는 fan-out에서 읽고 현재가·USD로 수익률을 계산한다', async () => {
        fetchDividendSource.mockResolvedValue({
            kind: 'fmp',
            rows: [{ exDate: '2026-08-10', amount: 1, payDate: '2026-08-13' }],
        });
        const r = (await getFundamentalsTool({ symbol: 'aapl' }, ctx, rt)) as {
            dividends: unknown;
        };
        expect(fetchDividendSource).toHaveBeenCalledWith('AAPL', false);
        expect(r.dividends).toMatchObject({
            latestExDate: '2026-08-10',
            currency: 'USD',
            trailing12mAmount: 1,
            trailingYieldPct: 0.5,
        });
    });

    it('한국 심볼: isKr로 부르고, 원자료가 null이면 dividends는 null이다', async () => {
        resolveMarketProfile.mockResolvedValue('kr-equity');
        getQuote.mockResolvedValue({
            price: 70000,
            changesPercentage: 0,
            timestamp: Math.floor(Date.now() / 1000),
        });
        sessionSpecFor.mockReturnValue({
            kind: 'scheduled',
            timeZone: 'Asia/Seoul',
            openMinute: 540,
            closeMinute: 930,
            weekendDays: [0, 6],
        });
        const r = (await getFundamentalsTool(
            { symbol: '005930.KS' },
            ctx,
            rt
        )) as { dividends: unknown };
        expect(fetchDividendSource).toHaveBeenCalledWith('005930.KS', true);
        expect(r.dividends).toBeNull();
    });
});

describe('earningsDateNoteFor', () => {
    it('확정이면 확정이라고 말한다', () => {
        expect(earningsDateNoteFor(true)).toMatch(/^Date confirmed/);
    });
    it('추정이면 바뀔 수 있다고 말한다', () => {
        expect(earningsDateNoteFor(false)).toMatch(/estimate; it may move/);
    });
    it('확정 여부를 모르면 예정일로 다루라고 말한다', () => {
        expect(earningsDateNoteFor(null)).toMatch(/no confirmation flag/);
    });
    it('세 경우 모두 발표 시각이 없다고 밝힌다', () => {
        for (const confirmed of [true, false, null])
            expect(earningsDateNoteFor(confirmed)).toContain(
                'Session timing (before/after market) is not provided by the data source; use web_search to find the timing the company announced and cite the source, never guess.'
            );
    });
});
