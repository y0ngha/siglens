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
    loadIndexMemberships,
    fetchKrAnnualDividend,
    loadSecQuarters,
    getAnalystViews,
    getFmpGrades,
    getKrValuation,
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
    loadIndexMemberships: vi.fn(),
    fetchKrAnnualDividend: vi.fn(),
    loadSecQuarters: vi.fn(),
    getAnalystViews: vi.fn(),
    getFmpGrades: vi.fn(),
    getKrValuation: vi.fn(),
}));
vi.mock('@/entities/kr-valuation/server/getKrValuation', () => ({
    getKrValuation,
}));
vi.mock('@/shared/api/fmp/getFmpGradesConsensus', () => ({
    getFmpGradesConsensus: getFmpGrades,
}));
vi.mock('@/entities/analyst-views/server/getAnalystViews', () => ({
    getAnalystViews,
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: isTabAllowed,
    findKrListedShares: findListedShares,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile,
}));
vi.mock('@/entities/ticker/server/getAssetInfo', () => ({
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
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/app/api/ai/chat/tools/dividends', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/app/api/ai/chat/tools/dividends')
    >()),
    fetchDividendSource,
}));
vi.mock('@/app/api/ai/chat/tools/krAnnualDividend', () => ({
    fetchKrAnnualDividend,
}));
vi.mock('@/app/api/ai/chat/tools/loadSecQuarters', () => ({
    loadSecQuarters,
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: 'fake-db' }),
}));
vi.mock('@/app/api/ai/chat/tools/indexMembership', () => ({
    loadIndexMemberships,
}));

import type { ResolvedNextEarnings } from '@/entities/analyst-views/lib/resolveNextEarnings';
import { providerKrValuation } from '@/entities/kr-valuation/lib/computeKrValuation';
import type { KrValuation } from '@/entities/kr-valuation/model';
import {
    daysUntil,
    earningsDateCertainty,
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
        loadIndexMemberships.mockResolvedValue(null);
        fetchKrAnnualDividend.mockResolvedValue(null);
        loadSecQuarters.mockResolvedValue(null);
        // 기본: Yahoo 애널리스트 뷰 없음(실패와 같은 모양) — 기존 단언이 FMP 값 그대로 나오는지 지킨다.
        getAnalystViews.mockResolvedValue(null);
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

    describe('한국 종목 시총(KRX 상장주식수 기준)과 PER·PBR(DART 기준)', () => {
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
                pe: number | null;
                pb: number | null;
                ps: number;
                evToEbitda: number | null;
                epsTtm?: number | null;
                bps?: number | null;
                basis?: KrValuation['basis'];
                nullReason?: KrValuation['nullReason'];
            };
        };
        /** DART 기준 값 — 제공처 값(20·4·800)과 눈에 띄게 다르다. */
        const DART_VALUATION: KrValuation = {
            pe: 12.3456789,
            pb: 1.2345678,
            epsTtm: 1363.6363,
            bps: 13_633.633,
            nullReason: {},
            basis: {
                source: 'dart',
                statements: 'consolidated',
                ttmEnd: '2026-06-30',
                equityAsOf: '2026-06-30',
                epsShares: 'issued_incl_treasury',
                bpsShares: 'outstanding_ex_treasury',
                sharesAsOf: '2026-06-30',
                priceDate: '2026-10-23',
                note: 'P/E = the 2026-10-23 close / …',
            },
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
            getKrValuation.mockImplementation(
                async (
                    _symbol: string,
                    _price: unknown,
                    provider: { pe: number; pb: number; epsTtm: number }
                ) => providerKrValuation(provider, 'dart_unavailable')
            );
        });

        it('상장주식수 × 직전 완료 종가로 시총을 내되 PER·PBR·PSR은 그 비율로 다시 곱하지 않는다', async () => {
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
            // 제공처 값이 곱해지지 않고 그대로 나간다(시총 비율 1.0303을 곱하면 20.6·4.12·1.03).
            expect(r.valuation).toMatchObject({ pe: 20, pb: 4, ps: 1 });
            // EV includes net debt; not recomputable from market cap alone.
            expect(r.valuation.evToEbitda).toBeNull();
        });

        it('PER·PBR은 DART 기준 값으로 내고 EPS·BPS·기준을 함께 싣는다', async () => {
            findListedShares.mockResolvedValue(880_000_000);
            getKrValuation.mockResolvedValue(DART_VALUATION);
            const r = (await getFundamentalsTool(
                { symbol: '010140.KS' },
                ctx,
                rt
            )) as KrResult;
            expect(r.valuation.pe).toBeCloseTo(12.3457, 3);
            expect(r.valuation.pb).toBeCloseTo(1.2346, 3);
            expect(r.valuation.epsTtm).toBeCloseTo(1363.64, 1);
            expect(r.valuation.bps).toBeCloseTo(13_633.6, 0);
            expect(r.valuation.basis).toEqual(DART_VALUATION.basis);
            // 시총은 KRX 상장주식수 기준 그대로다.
            expect(r.profile.sharesBasis).toBe('krx_listed');
            // PSR은 제공처 값이고 DART 계산의 영향을 받지 않는다.
            expect(r.valuation.ps).toBe(1);
        });

        it('같은 종목의 마지막 완료 종가와 제공처 값을 `getKrValuation`에 넘긴다', async () => {
            findListedShares.mockResolvedValue(880_000_000);
            await getFundamentalsTool({ symbol: '010140.KS' }, ctx, rt);
            const call = getKrValuation.mock.calls.find(
                ([symbol]) => symbol === '010140.KS'
            );
            expect(call?.[1]).toEqual({ close: 16830, date: '2026-10-23' });
            expect(call?.[2]).toEqual({ pe: 20, pb: 4, epsTtm: 800 });
        });

        it('PER·PBR이 빈 이유는 nullReason으로 싣고, 빈 값이 없으면 키를 싣지 않는다', async () => {
            findListedShares.mockResolvedValue(880_000_000);
            getKrValuation.mockResolvedValue({
                ...DART_VALUATION,
                pe: null,
                nullReason: { pe: 'loss' },
            });
            const empty = (await getFundamentalsTool(
                { symbol: '010140.KS' },
                ctx,
                rt
            )) as KrResult;
            expect(empty.valuation.pe).toBeNull();
            expect(empty.valuation.nullReason).toEqual({ pe: 'loss' });

            getKrValuation.mockResolvedValue(DART_VALUATION);
            const full = (await getFundamentalsTool(
                { symbol: '010140.KS' },
                ctx,
                rt
            )) as KrResult;
            expect(full.valuation).not.toHaveProperty('nullReason');
        });

        it('DART를 못 쓰면 제공처 값 그대로이고 basis가 provider라고 말한다', async () => {
            findListedShares.mockResolvedValue(880_000_000);
            const r = (await getFundamentalsTool(
                { symbol: '010140.KS' },
                ctx,
                rt
            )) as KrResult;
            expect(r.valuation).toMatchObject({
                pe: 20,
                pb: 4,
                epsTtm: 800,
                bps: null,
            });
            expect(r.valuation.basis?.source).toBe('provider');
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
                // PER·PBR 분자도 같은 완료 종가다.
                const call = getKrValuation.mock.calls.find(
                    ([symbol]) => symbol === '010140.KS'
                );
                expect(call?.[1]).toEqual({ close: 16500, date: '2026-10-22' });
            } finally {
                vi.useRealTimers();
            }
        });

        it('상장주식수가 없으면 시총은 프로바이더 값 그대로 두고 provider로 표시한다', async () => {
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

        it('일봉 로드가 실패하면 시총은 provider로 폴백하고 PER·PBR 분자 종가는 null로 넘긴다', async () => {
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
                const call = getKrValuation.mock.calls.find(
                    ([symbol]) => symbol === '010140.KS'
                );
                expect(call?.[1]).toBeNull();
            } finally {
                consoleErrorSpy.mockRestore();
                consoleWarnSpy.mockRestore();
            }
        });

        it('제공처 지표가 없으면(null) `getKrValuation`을 부르지 않고 valuation은 null이다', async () => {
            getProvider.mockReturnValue(
                fakeProvider({
                    getProfile: krProvider().getProfile,
                    getKeyMetricsTtm: vi.fn().mockResolvedValue(null),
                })
            );
            findListedShares.mockResolvedValue(880_000_000);
            const r = (await getFundamentalsTool(
                { symbol: '010140.KS' },
                ctx,
                rt
            )) as { valuation: unknown };
            expect(r.valuation).toBeNull();
            expect(getKrValuation).not.toHaveBeenCalled();
        });

        // 실측 3,541자(2026-11-22): 모든 섹션 + DART 기준 블록(`valuation.basis` 노트 포함, +≈660자) + 5분기 + 8 반응 + 확정 배당.
        it('한국 종목 최악 케이스(DART 기준 블록 + 5분기 + 8 반응 + 확정 배당)도 공용 도구 예산 안에 든다', async () => {
            findListedShares.mockResolvedValue(880_000_000);
            getKrValuation.mockResolvedValue({
                ...DART_VALUATION,
                pe: null,
                pb: null,
                nullReason: { pe: 'missing', pb: 'missing' },
                basis: {
                    ...DART_VALUATION.basis,
                    ttmEnd: '2026-09-30',
                    equityAsOf: '2026-09-30',
                    note: 'P/E = the 2026-11-20 close / trailing-4-quarter DART consolidated controlling-interest EPS to 2026-09-30 (net income per issued share, common and preferred, treasury shares included); P/B = the 2026-11-20 close / DART consolidated controlling-interest equity at 2026-09-30 per outstanding share (common and preferred, treasury shares excluded).',
                },
            });
            getIncomeStatements.mockResolvedValue(
                Array.from({ length: 8 }, (_, i) => ({
                    fiscalYear: '2026',
                    period: `Q${(i % 4) + 1}`,
                    date: `2026-0${(i % 9) + 1}-28`,
                    filingDate: '2026-10-01',
                    reportedCurrency: 'KRW',
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
                bars: days.map((d, i) => dayBar(d, 16_000 + i * 1.2345)),
                indicators: {},
            });
            listReportedEarningsDates.mockResolvedValue(
                days.filter((_, i) => i % 40 === 20)
            );
            fetchDividendSource.mockResolvedValue({
                kind: 'fmp',
                rows: [
                    {
                        exDate: '2026-08-10',
                        amount: 270,
                        payDate: '2026-08-13',
                    },
                    {
                        exDate: '2026-05-11',
                        amount: 260,
                        payDate: '2026-05-14',
                    },
                ],
            });
            fetchKrAnnualDividend.mockResolvedValue({
                fiscalYear: 2025,
                dpsCommon: 6000,
                dartYieldPct: 4.3,
            });
            const r = (await getFundamentalsTool(
                { symbol: '010140.KS' },
                ctx,
                rt
            )) as { recentQuarters: unknown[]; earningsReactions: unknown[] };
            expect(r.recentQuarters).toHaveLength(5);
            expect(r.earningsReactions).toHaveLength(8);
            expect(JSON.stringify(r)).toContain('annualReported');
            expect(JSON.stringify(r)).toContain('"basis"');
            expect(JSON.stringify(r).length).toBeLessThan(
                TOOL_RESULT_MAX_CHARS
            );
        });

        it('미국 종목은 상장주식수 조회도 DART 기준도 새 필드도 없다', async () => {
            resolveMarketProfile.mockResolvedValue('us-equity');
            getProvider.mockReturnValue(fakeProvider());
            const r = (await getFundamentalsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as {
                profile: Record<string, unknown>;
                valuation: Record<string, unknown>;
            };
            expect(findListedShares).not.toHaveBeenCalled();
            expect(getKrValuation).not.toHaveBeenCalled();
            expect(r.profile).not.toHaveProperty('sharesBasis');
            expect(r.valuation).not.toHaveProperty('basis');
            expect(r.valuation).not.toHaveProperty('epsTtm');
            expect(r.valuation).not.toHaveProperty('bps');
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

    describe('indexMemberships', () => {
        it('편입 정보를 그대로 싣고 심볼을 넘긴다', async () => {
            const memberships = {
                sp500: true,
                nasdaq100: true,
                dowJones: false,
                asOf: '2026-10-24',
                source: 'wikipedia' as const,
            };
            loadIndexMemberships.mockResolvedValue(memberships);
            getProvider.mockReturnValue(fakeProvider());
            const r = (await getFundamentalsTool(
                { symbol: 'exc' },
                ctx,
                rt
            )) as { indexMemberships: unknown };
            expect(r.indexMemberships).toEqual(memberships);
            expect(loadIndexMemberships).toHaveBeenCalledWith('EXC');
        });

        it('목록을 못 읽어 던지면 null로 degrade하고 나머지 섹션은 살린다', async () => {
            loadIndexMemberships.mockRejectedValue(new Error('wikipedia down'));
            getProvider.mockReturnValue(fakeProvider());
            const r = (await getFundamentalsTool(
                { symbol: 'AAPL' },
                ctx,
                rt
            )) as { available: boolean; indexMemberships: unknown };
            expect(r.available).toBe(true);
            expect(r.indexMemberships).toBeNull();
        });
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
            'Provider marks this date as an estimate; it may move. Session timing has not been announced while the date itself is unsettled; say so and do not search for it.',
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
                    sec: null,
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
                    sec: null,
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

        describe('SEC XBRL quarters', () => {
            const secQuarter = {
                periodEnd: '2026-06-30',
                form: '10-Q' as const,
                accn: '0000051434-26-000123',
                filed: '2026-08-05',
                epsDiluted: 0.5,
                revenue: 6_004_000_000,
                revenueYoYPct: -2.25,
            };
            type Quarters = {
                recentQuarters:
                    | {
                          form: unknown;
                          revenueYoYPct: unknown;
                          epsDiluted: unknown;
                          sec: unknown;
                      }[]
                    | null;
            };

            it('adds the as-filed figures to a matching quarter and prefers the SEC YoY, keeping the FMP fields', async () => {
                getProvider.mockReturnValue(fakeProvider());
                getIncomeStatements.mockResolvedValue([
                    incomeRow('2026-06-30', 'Q2'),
                ]);
                loadSecQuarters.mockResolvedValue([secQuarter]);
                const r = (await getFundamentalsTool(
                    { symbol: 'IP' },
                    ctx,
                    rt
                )) as Quarters;
                expect(loadSecQuarters).toHaveBeenCalledWith('IP', 'fake-db');
                expect(r.recentQuarters?.[0]).toMatchObject({
                    form: '10-Q',
                    epsDiluted: 5.58,
                    revenueYoYPct: -2.25,
                    sec: {
                        form: '10-Q',
                        epsDiluted: 0.5,
                        revenue: 6_004_000_000,
                        revenueYoYPct: -2.25,
                        filed: '2026-08-05',
                        accn: '0000051434-26-000123',
                    },
                });
            });

            it('a Korean stock never asks the SEC', async () => {
                getProvider.mockReturnValue(fakeProvider());
                getIncomeStatements.mockResolvedValue([
                    incomeRow('2026-06-30', 'Q2'),
                ]);
                const r = (await getFundamentalsTool(
                    { symbol: '005930.KS' },
                    ctx,
                    rt
                )) as Quarters;
                expect(loadSecQuarters).not.toHaveBeenCalled();
                expect(r.recentQuarters?.[0]).toMatchObject({
                    form: null,
                    sec: null,
                });
            });

            it('an SEC failure degrades to the FMP-based rows with a logged, message-free diagnostic', async () => {
                const logged = vi
                    .spyOn(console, 'error')
                    .mockImplementation(() => undefined);
                try {
                    getProvider.mockReturnValue(fakeProvider());
                    getIncomeStatements.mockResolvedValue([
                        incomeRow('2026-06-30', 'Q2'),
                    ]);
                    loadSecQuarters.mockRejectedValue(
                        new Error('SEC 503 secret-detail')
                    );
                    const r = (await getFundamentalsTool(
                        { symbol: 'IP' },
                        ctx,
                        rt
                    )) as Quarters;
                    expect(r.recentQuarters?.[0]).toMatchObject({
                        form: '10-Q',
                        epsDiluted: 5.58,
                        sec: null,
                    });
                    const call = logged.mock.calls.find(
                        c => c[2] === 'sec xbrl quarters failed, degrading'
                    );
                    expect(call).toBeDefined();
                    expect(JSON.stringify(call)).not.toContain('secret-detail');
                } finally {
                    logged.mockRestore();
                }
            });
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
        loadIndexMemberships.mockResolvedValue({
            sp500: true,
            nasdaq100: true,
            dowJones: true,
            asOf: '2026-10-24',
            source: 'wikipedia',
        });
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
        // Worst case: every shown quarter also carries its full `sec` block.
        loadSecQuarters.mockResolvedValue(
            Array.from({ length: 8 }, (_, i) => ({
                periodEnd: `2026-0${(i % 9) + 1}-28`,
                form: '10-Q' as const,
                accn: '0001234567-26-000123',
                filed: '2026-10-01',
                epsDiluted: 12.3456,
                revenue: 123_456_789_012,
                revenueYoYPct: -12.34,
            }))
        );
        // Worst case also carries the Yahoo extras: ratings, Yahoo target, confirmed session + call time.
        getNextEarningsSchedule.mockResolvedValue({
            symbol: 'AAPL',
            earningsDate: '2099-01-10',
            dateConfirmed: null,
        });
        getAnalystViews.mockResolvedValue({
            asOf: '2026-11-15T12:00:00.000Z',
            symbol: 'AAPL',
            targets: {
                yahoo: {
                    mean: 276.56,
                    median: 280,
                    low: 150,
                    high: 400,
                    analysts: 53,
                },
                fmp: null,
                gapPct: 12.94,
                sourcesDisagree: true,
            },
            ratings: {
                strongBuy: 10,
                buy: 37,
                hold: 14,
                sell: 0,
                strongSell: 0,
                analysts: 61,
                source: 'yahoo',
            },
            actions: { available: true, rows: [], tally: {} },
            earnings: {
                date: '2099-01-10',
                isEstimate: false,
                session: 'during_market',
                callAt: '2099-01-10T22:00:00.000Z',
            },
            degraded: [],
        });
        const r = (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            recentQuarters: { sec: unknown }[];
            earningsReactions: unknown[];
            dividends: unknown;
        };
        expect(r.dividends).not.toBeNull();
        expect(r.recentQuarters.every(q => q.sec !== null)).toBe(true);
        expect(r.recentQuarters).toHaveLength(5);
        expect(r.earningsReactions).toHaveLength(8);
        expect(JSON.stringify(r).length).toBeLessThan(TOOL_RESULT_MAX_CHARS);
        expect(JSON.stringify(r)).toContain('earningsSession');
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
        fetchKrAnnualDividend.mockResolvedValue(null);
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
        expect(fetchKrAnnualDividend).not.toHaveBeenCalled();
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

    it('한국 심볼: DART 확정 배당을 현재가로 환산해 annualReported에 붙인다', async () => {
        resolveMarketProfile.mockResolvedValue('kr-equity');
        getQuote.mockResolvedValue({
            price: 189400,
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
        fetchDividendSource.mockResolvedValue({
            kind: 'yahoo',
            data: {
                history: [{ exDate: '2025-12-29', amount: 3000 }],
                summary: null,
            },
        });
        fetchKrAnnualDividend.mockResolvedValue({
            fiscalYear: 2025,
            dpsCommon: 6000,
            dartYieldPct: 4.1,
        });
        const r = (await getFundamentalsTool(
            { symbol: '033780.KS' },
            ctx,
            rt
        )) as { dividends: { annualReported?: unknown } };
        expect(fetchKrAnnualDividend).toHaveBeenCalledWith('033780.KS');
        expect(r.dividends.annualReported).toEqual({
            fiscalYear: 2025,
            dpsCommon: 6000,
            dartYieldPct: 4.1,
            yieldOnLastClosePct: 3.17,
            source: 'DART',
        });
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

describe('earningsDateNoteFor (세션 제공 여부)', () => {
    it('세션이 함께 나가면 web_search로 찾으라는 문장을 빼고 earningsSession을 가리킨다', () => {
        for (const confirmed of [true, false, null]) {
            const note = earningsDateNoteFor(confirmed, 'given');
            expect(note).not.toContain('web_search');
            expect(note).toContain('earningsSession');
        }
    });

    it('날짜가 미정이면 시간대가 아직 공지되지 않았다고 하고 검색을 시키지 않는다', () => {
        for (const confirmed of [true, false, null]) {
            const note = earningsDateNoteFor(confirmed, 'unsettled');
            expect(note).not.toContain('use web_search');
            expect(note).toContain('do not search for it');
        }
    });
});

describe('earningsDateCertainty', () => {
    // 대조 규칙 자체(3상태·승격·alt)는 `resolveNextEarnings` 테스트가 맡는다. 여기서는 결과 → 도구 필드 변환만 본다.
    const resolved = (
        over: Partial<ResolvedNextEarnings> = {}
    ): ResolvedNextEarnings => ({
        date: '2026-11-17',
        confirmed: null,
        session: null,
        callAt: null,
        alt: null,
        ...over,
    });

    it('일정 행이 없으면 빈 객체', () => {
        expect(earningsDateCertainty(null)).toEqual({});
    });

    it('확정 여부만 있으면 세션 필드 없이 노트를 낸다', () => {
        expect(earningsDateCertainty(resolved())).toEqual({
            earningsDateConfirmed: null,
            earningsDateNote: earningsDateNoteFor(null),
        });
        expect(
            earningsDateCertainty(resolved({ confirmed: true }))
        ).toMatchObject({
            earningsDateConfirmed: true,
            earningsDateNote: earningsDateNoteFor(true),
        });
    });

    it('확정이면 세션과 (있으면) 콜 시각을 싣고 노트는 검색을 안내하지 않는다', () => {
        const r = earningsDateCertainty(
            resolved({
                confirmed: true,
                session: 'after_market',
                callAt: '2026-11-17T22:00:00.000Z',
            })
        );
        expect(r).toMatchObject({
            earningsDateConfirmed: true,
            earningsSession: 'after_market',
            earningsCallAt: '2026-11-17T22:00:00.000Z',
        });
        expect(r.earningsDateNote).not.toContain('web_search');
    });

    it('콜 시각이 없으면 earningsCallAt 키를 내지 않는다', () => {
        const r = earningsDateCertainty(
            resolved({ confirmed: true, session: 'before_market' })
        );
        expect(r).toHaveProperty('earningsSession', 'before_market');
        expect(r).not.toHaveProperty('earningsCallAt');
    });

    it('추정일이면 세션을 내지 않고 노트는 검색을 시키지 않는다', () => {
        const r = earningsDateCertainty(resolved({ confirmed: false }));
        expect(r).not.toHaveProperty('earningsSession');
        expect(r).not.toHaveProperty('earningsCallAt');
        expect(r.earningsDateNote).toBe(
            earningsDateNoteFor(false, 'unsettled')
        );
    });

    it('두 출처의 날짜가 다르면 확정 여부를 몰라도 검색을 시키지 않는다', () => {
        const r = earningsDateCertainty(
            resolved({
                alt: { date: '2026-11-24', source: 'yahoo', estimate: true },
            })
        );
        expect(r.earningsDateConfirmed).toBeNull();
        expect(r.earningsDateNote).toBe(earningsDateNoteFor(null, 'unsettled'));
    });

    it('날짜가 하나뿐이고 확정 여부를 모르면 기존 검색 안내를 유지한다', () => {
        expect(earningsDateCertainty(resolved()).earningsDateNote).toContain(
            'use web_search to find the timing'
        );
    });
});

describe('getFundamentalsTool - Yahoo 애널리스트 보강', () => {
    // 먼 미래 날짜를 써서 시계를 고정하지 않고도 "오늘 이후"가 항상 성립하게 한다.
    const FMP_DATE = '2099-01-10';
    const ALT_DATE = '2099-01-20';

    const views = (over: Record<string, unknown> = {}) => ({
        asOf: '2026-11-15T12:00:00.000Z',
        symbol: 'AAPL',
        targets: {
            yahoo: {
                mean: 276.56,
                median: 280,
                low: 150,
                high: 400,
                analysts: 53,
            },
            fmp: null,
            gapPct: 12.9,
            sourcesDisagree: true,
        },
        ratings: {
            strongBuy: 10,
            buy: 37,
            hold: 14,
            sell: 0,
            strongSell: 0,
            analysts: 61,
            source: 'yahoo',
        },
        actions: { available: true, rows: [], tally: {} },
        earnings: null,
        degraded: [],
        ...over,
    });
    const schedule = (dateConfirmed: boolean | null = null) => ({
        symbol: 'AAPL',
        earningsDate: FMP_DATE,
        dateConfirmed,
    });
    type Analyst = {
        consensus: Record<string, number> | null;
        consensusAnalysts: number | null;
        consensusSource: string | null;
        analystBuySharePct: number | null;
        priceTarget: unknown;
        priceTargetSource: string | null;
        priceTargetYahoo: { mean: number; analysts: number } | null;
        targetSourcesDisagree: boolean;
        earningsDateConfirmed?: boolean | null;
        earningsDateNote?: string;
        earningsSession?: string;
        earningsCallAt?: string;
        nextEarningsDate?: string | null;
        earningsDateAlt?: {
            date: string;
            source: string;
            estimate: boolean | null;
        };
    };
    const analyst = async (symbol = 'AAPL') =>
        (
            (await getFundamentalsTool({ symbol }, ctx, rt)) as {
                analyst: Analyst;
            }
        ).analyst;

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
        loadIndexMemberships.mockResolvedValue(null);
        fetchKrAnnualDividend.mockResolvedValue(null);
        loadSecQuarters.mockResolvedValue(null);
        sessionSpecFor.mockReturnValue({
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 570,
            closeMinute: 960,
            weekendDays: [0, 6],
        });
        getProvider.mockReturnValue(fakeProvider());
        getAnalystViews.mockResolvedValue(views());
    });

    const YAHOO_GRADES = {
        strongBuy: 10,
        buy: 37,
        hold: 14,
        sell: 0,
        strongSell: 0,
        source: 'yahoo',
    };

    it('미국: 프로바이더가 준 Yahoo 분포를 그대로 쓰고 합계·매수 비율·출처가 그 분포를 따른다', async () => {
        getProvider.mockReturnValue(
            fakeProvider({
                getGradesConsensus: vi.fn().mockResolvedValue(YAHOO_GRADES),
            })
        );
        const a = await analyst();
        expect(a.consensus).toEqual({
            strongBuy: 10,
            buy: 37,
            hold: 14,
            sell: 0,
            strongSell: 0,
        });
        expect(a.consensusAnalysts).toBe(61);
        expect(a.consensusSource).toBe('yahoo');
        expect(a.analystBuySharePct).toBeCloseTo((47 / 61) * 100, 3);
    });

    it('미국: 도구는 애널리스트 뷰의 ratings로 분포를 바꾸지 않는다', async () => {
        // 뷰는 Yahoo 분포(61명)를 들고 있지만 프로바이더가 FMP 값을 줬다면 그 값이 나간다.
        getProvider.mockReturnValue(
            fakeProvider({
                getGradesConsensus: vi.fn().mockResolvedValue({
                    strongBuy: 10,
                    buy: 20,
                    hold: 5,
                    sell: 1,
                    strongSell: 0,
                    source: 'fmp',
                }),
            })
        );
        const a = await analyst();
        expect(a.consensus).toEqual({
            strongBuy: 10,
            buy: 20,
            hold: 5,
            sell: 1,
            strongSell: 0,
        });
    });

    it('미국: 출처가 FMP이면 합계는 애널리스트 수가 아니라서 consensusAnalysts는 null', async () => {
        getProvider.mockReturnValue(
            fakeProvider({
                getGradesConsensus: vi.fn().mockResolvedValue({
                    strongBuy: 10,
                    buy: 20,
                    hold: 5,
                    sell: 1,
                    strongSell: 0,
                    source: 'fmp',
                }),
            })
        );
        const a = await analyst();
        expect(a.consensusAnalysts).toBeNull();
        expect(a.consensusSource).toBe('fmp');
        expect(a.analystBuySharePct).toBeCloseTo((30 / 36) * 100, 3);
    });

    it('미국: Yahoo 실패로 내려온 FMP 값은 yahooFailed를 벗기고 출처는 fmp로 낸다', async () => {
        getProvider.mockReturnValue(
            fakeProvider({
                getGradesConsensus: vi.fn().mockResolvedValue({
                    strongBuy: 10,
                    buy: 20,
                    hold: 5,
                    sell: 1,
                    strongSell: 0,
                    source: 'fmp',
                    yahooFailed: true,
                }),
            })
        );
        const a = await analyst();
        expect(a.consensus).toEqual({
            strongBuy: 10,
            buy: 20,
            hold: 5,
            sell: 1,
            strongSell: 0,
        });
        expect(a.consensusSource).toBe('fmp');
        expect(a.consensusAnalysts).toBeNull();
    });

    it('출처 표시가 없는 값(구버전 캐시)은 출처 null, 인원 수도 null', async () => {
        const a = await analyst();
        expect(a.consensusSource).toBeNull();
        expect(a.consensusAnalysts).toBeNull();
    });

    it('애널리스트 뷰가 통째로 실패해도 도구는 살아 있다', async () => {
        getAnalystViews.mockRejectedValue(new Error('boom'));
        const a = await analyst();
        expect(a.consensus).not.toBeNull();
        expect(a.priceTargetYahoo).toBeNull();
        expect(a.targetSourcesDisagree).toBe(false);
    });

    it('분포가 아예 없으면 합계·출처·매수 비율은 null', async () => {
        getProvider.mockReturnValue(
            fakeProvider({
                getGradesConsensus: vi.fn().mockResolvedValue(null),
            })
        );
        const a = await analyst();
        expect(a.consensus).toBeNull();
        expect(a.consensusAnalysts).toBeNull();
        expect(a.consensusSource).toBeNull();
        expect(a.analystBuySharePct).toBeNull();
    });

    it('미국: priceTarget은 FMP 그대로, priceTargetYahoo와 불일치 플래그가 옆에 붙는다', async () => {
        const a = await analyst();
        expect(a.priceTargetSource).toBe('fmp');
        expect(a.priceTargetYahoo).toEqual({ mean: 276.56, analysts: 53 });
        expect(a.targetSourcesDisagree).toBe(true);
    });

    it('priceTarget이 없으면 priceTargetSource는 null', async () => {
        getProvider.mockReturnValue(
            fakeProvider({
                getPriceTargetConsensus: vi.fn().mockResolvedValue(null),
            })
        );
        expect((await analyst()).priceTargetSource).toBeNull();
    });

    it('한국: 분포는 프로바이더(Yahoo) 것, 출처 yahoo, 보강 필드는 비운다', async () => {
        resolveMarketProfile.mockResolvedValue('kr-equity');
        getQuote.mockResolvedValue({
            price: 70000,
            changesPercentage: 0,
            timestamp: Math.floor(Date.now() / 1000),
        });
        getProvider.mockReturnValue(
            fakeProvider({
                getGradesConsensus: vi.fn().mockResolvedValue({
                    strongBuy: 10,
                    buy: 20,
                    hold: 5,
                    sell: 1,
                    strongSell: 0,
                    source: 'yahoo',
                }),
            })
        );
        const a = await analyst('005930.KS');
        expect(getAnalystViews).not.toHaveBeenCalled();
        expect(a.consensusSource).toBe('yahoo');
        expect(a.consensusAnalysts).toBe(36);
        expect(a.priceTargetSource).toBe('yahoo');
        expect(a.priceTargetYahoo).toBeNull();
        expect(a.targetSourcesDisagree).toBe(false);
        expect(a).not.toHaveProperty('earningsSession');
        expect(a).not.toHaveProperty('earningsDateAlt');
    });

    it("미국: 가벼운 조회('lite')로 부른다 — 이력·기간 평균은 이 도구에 필요 없다", async () => {
        await analyst();
        expect(getAnalystViews).toHaveBeenCalledTimes(1);
        expect(getAnalystViews).toHaveBeenCalledWith('AAPL', {
            detail: 'lite',
        });
    });

    describe('공개 API 런타임(allowUnofficialSources: false)', () => {
        const publicRt = { ...rt, allowUnofficialSources: false };
        beforeEach(() => {
            getFmpGrades.mockResolvedValue(null);
        });
        const YAHOO_ONLY_KEYS = [
            'consensusAnalysts',
            'consensusSource',
            'priceTargetSource',
            'priceTargetYahoo',
            'targetSourcesDisagree',
            'earningsSession',
            'earningsCallAt',
            'earningsDateAlt',
        ];
        const run = async (symbol = 'AAPL') =>
            (
                (await getFundamentalsTool({ symbol }, ctx, publicRt)) as {
                    analyst: Analyst & Record<string, unknown>;
                }
            ).analyst;

        it('Yahoo를 부르지 않고 Yahoo 유래 키를 하나도 내지 않는다', async () => {
            getNextEarningsSchedule.mockResolvedValue(schedule(null));
            // 호출됐다면 확정 승격까지 일어났을 값 — 호출 자체가 없어야 한다.
            getAnalystViews.mockResolvedValue(
                views({
                    earnings: {
                        date: ALT_DATE,
                        isEstimate: false,
                        session: 'after_market',
                        callAt: `${ALT_DATE}T22:00:00.000Z`,
                    },
                })
            );
            const a = await run();
            expect(getAnalystViews).not.toHaveBeenCalled();
            for (const key of YAHOO_ONLY_KEYS)
                expect(a).not.toHaveProperty(key);
        });

        const FMP_COUNTS = {
            strongBuy: 40,
            buy: 70,
            hold: 32,
            sell: 2,
            strongSell: 1,
        };

        it('미국: FMP 자체 건수 함수를 읽고 Yahoo 우선 프로바이더 메서드는 부르지 않는다', async () => {
            getFmpGrades.mockResolvedValue(FMP_COUNTS);
            const providerGrades = vi.fn().mockResolvedValue({
                strongBuy: 10,
                buy: 37,
                hold: 14,
                sell: 0,
                strongSell: 0,
                source: 'yahoo',
            });
            getProvider.mockReturnValue(
                fakeProvider({ getGradesConsensus: providerGrades })
            );
            getNextEarningsSchedule.mockResolvedValue(schedule(null));

            const a = await run();

            expect(getFmpGrades).toHaveBeenCalledWith('AAPL');
            expect(providerGrades).not.toHaveBeenCalled();
            expect(a.consensus).toEqual(FMP_COUNTS);
            expect(a.analystBuySharePct).toBeCloseTo((110 / 145) * 100, 3);
            for (const key of YAHOO_ONLY_KEYS)
                expect(a).not.toHaveProperty(key);
            expect(a.nextEarningsDate).toBe(FMP_DATE);
            expect(a.earningsDateConfirmed).toBeNull();
            expect(a.earningsDateNote).toBe(earningsDateNoteFor(null));
        });

        it('미국: FMP 건수가 없으면 consensus는 null', async () => {
            getFmpGrades.mockResolvedValue(null);
            const a = await run();
            expect(a.consensus).toBeNull();
        });

        it('한국 종목도 같은 키 집합이다(기존 응답 모양)', async () => {
            resolveMarketProfile.mockResolvedValue('kr-equity');
            getQuote.mockResolvedValue({
                price: 70000,
                changesPercentage: 0,
                timestamp: Math.floor(Date.now() / 1000),
            });
            getProvider.mockReturnValue(
                fakeProvider({
                    getGradesConsensus: vi.fn().mockResolvedValue({
                        strongBuy: 10,
                        buy: 20,
                        hold: 5,
                        sell: 1,
                        strongSell: 0,
                        source: 'yahoo',
                    }),
                })
            );
            const a = await run('005930.KS');
            for (const key of YAHOO_ONLY_KEYS)
                expect(a).not.toHaveProperty(key);
            expect(getAnalystViews).not.toHaveBeenCalled();
            // 한국 종목은 원래 Yahoo 프로바이더 경로 — FMP 자체 함수를 거치지 않고, 출처 표시는 벗긴다.
            expect(getFmpGrades).not.toHaveBeenCalled();
            expect(a.consensus).toEqual({
                strongBuy: 10,
                buy: 20,
                hold: 5,
                sell: 1,
                strongSell: 0,
            });
        });

        it('에이전트 런타임(옵션 생략)은 그대로 보강한다', async () => {
            getProvider.mockReturnValue(
                fakeProvider({
                    getGradesConsensus: vi.fn().mockResolvedValue({
                        strongBuy: 10,
                        buy: 37,
                        hold: 14,
                        sell: 0,
                        strongSell: 0,
                        source: 'yahoo',
                    }),
                })
            );
            const a = (await analyst()) as Analyst;
            expect(a.consensusSource).toBe('yahoo');
        });
    });

    describe('실적 일정', () => {
        const yahooEarnings = (over: Record<string, unknown> = {}) => ({
            date: FMP_DATE,
            isEstimate: false,
            session: 'after_market',
            callAt: `${FMP_DATE}T22:00:00.000Z`,
            ...over,
        });

        it('같은 날짜 + 확정: earningsDateConfirmed true, 세션·콜 시각, 검색 안내 없음, alt 없음', async () => {
            getNextEarningsSchedule.mockResolvedValue(schedule(null));
            getAnalystViews.mockResolvedValue(
                views({ earnings: yahooEarnings() })
            );
            const a = await analyst();
            expect(a.earningsDateConfirmed).toBe(true);
            expect(a.earningsSession).toBe('after_market');
            expect(a.earningsCallAt).toBe(`${FMP_DATE}T22:00:00.000Z`);
            expect(a.earningsDateNote).not.toContain('web_search');
            expect(a).not.toHaveProperty('earningsDateAlt');
        });

        it('같은 날짜 + 추정: earningsDateConfirmed false, 세션 없음, 검색 안내 없음', async () => {
            getNextEarningsSchedule.mockResolvedValue(schedule(true));
            getAnalystViews.mockResolvedValue(
                views({
                    earnings: yahooEarnings({
                        isEstimate: true,
                        session: null,
                    }),
                })
            );
            const a = await analyst();
            expect(a.earningsDateConfirmed).toBe(false);
            expect(a).not.toHaveProperty('earningsSession');
            expect(a.earningsDateNote).toContain('do not search for it');
        });

        it('같은 날짜 + isEstimate null: 기존 확정 값을 유지한다', async () => {
            getNextEarningsSchedule.mockResolvedValue(schedule(true));
            getAnalystViews.mockResolvedValue(
                views({
                    earnings: yahooEarnings({
                        isEstimate: null,
                        session: null,
                    }),
                })
            );
            expect((await analyst()).earningsDateConfirmed).toBe(true);
        });

        it('날짜가 다르고 둘 다 미래이며 Yahoo가 추정이면: earningsDateAlt + 미정 안내, 확정 여부는 기존 그대로, 세션은 없다', async () => {
            getNextEarningsSchedule.mockResolvedValue(schedule(null));
            getAnalystViews.mockResolvedValue(
                views({
                    earnings: yahooEarnings({
                        date: ALT_DATE,
                        isEstimate: true,
                        session: null,
                        callAt: null,
                    }),
                })
            );
            const a = await analyst();
            expect(a.earningsDateAlt).toEqual({
                date: ALT_DATE,
                source: 'yahoo',
                estimate: true,
            });
            expect(a.nextEarningsDate).toBe(FMP_DATE);
            expect(a.earningsDateConfirmed).toBeNull();
            expect(a.earningsDateNote).toBe(
                earningsDateNoteFor(null, 'unsettled')
            );
            // alt와 세션은 같은 응답에 함께 나오지 않는다.
            expect(a).not.toHaveProperty('earningsSession');
            expect(a).not.toHaveProperty('earningsCallAt');
        });

        describe('Yahoo의 확정 날짜가 FMP 추정 날짜를 이긴다', () => {
            const confirmed = (over: Record<string, unknown> = {}) =>
                views({
                    earnings: yahooEarnings({
                        date: ALT_DATE,
                        isEstimate: false,
                        session: 'after_market',
                        callAt: `${ALT_DATE}T22:00:00.000Z`,
                        ...over,
                    }),
                });
            const full = async () =>
                (await getFundamentalsTool({ symbol: 'AAPL' }, ctx, rt)) as {
                    analyst: Analyst & {
                        nextEarningsDate: string | null;
                        daysToEarnings: number | null;
                    };
                };

            it('날짜가 다르고 Yahoo가 확정이며 미래면: Yahoo 날짜·확정·세션·콜 시각, alt 없음', async () => {
                getNextEarningsSchedule.mockResolvedValue(schedule(null));
                getAnalystViews.mockResolvedValue(confirmed());
                const { analyst: a } = await full();
                expect(a.nextEarningsDate).toBe(ALT_DATE);
                expect(a.earningsDateConfirmed).toBe(true);
                expect(a.earningsSession).toBe('after_market');
                expect(a.earningsCallAt).toBe(`${ALT_DATE}T22:00:00.000Z`);
                expect(a.earningsDateNote).toBe(
                    earningsDateNoteFor(true, 'given')
                );
                expect(a).not.toHaveProperty('earningsDateAlt');
            });

            it('daysToEarnings는 승격된 날짜를 따른다', async () => {
                getNextEarningsSchedule.mockResolvedValue(schedule(null));
                getAnalystViews.mockResolvedValue(confirmed());
                const { analyst: a } = await full();
                expect(a.daysToEarnings).toBe(
                    daysUntil(ALT_DATE, new Date(), 'America/New_York')
                );
                expect(a.daysToEarnings).not.toBe(
                    daysUntil(FMP_DATE, new Date(), 'America/New_York')
                );
            });

            it('세션이 없으면 승격하되 검색 안내 문장을 유지한다', async () => {
                getNextEarningsSchedule.mockResolvedValue(schedule(null));
                getAnalystViews.mockResolvedValue(
                    confirmed({ session: null, callAt: null })
                );
                const { analyst: a } = await full();
                expect(a.nextEarningsDate).toBe(ALT_DATE);
                expect(a).not.toHaveProperty('earningsSession');
                expect(a.earningsDateNote).toBe(
                    earningsDateNoteFor(true, 'not_provided')
                );
            });

            it('FMP 날짜가 이미 지난 행이어도(옛 일정) Yahoo의 확정 미래 날짜를 쓴다', async () => {
                getNextEarningsSchedule.mockResolvedValue({
                    ...schedule(null),
                    earningsDate: '2020-01-10',
                });
                getAnalystViews.mockResolvedValue(confirmed());
                const { analyst: a } = await full();
                expect(a.nextEarningsDate).toBe(ALT_DATE);
                expect(a.earningsDateConfirmed).toBe(true);
                expect(a).not.toHaveProperty('earningsDateAlt');
            });

            it('Yahoo 날짜가 이미 지났으면 승격하지 않는다(지난 일정은 일정이 아니다)', async () => {
                getNextEarningsSchedule.mockResolvedValue(schedule(null));
                getAnalystViews.mockResolvedValue(
                    confirmed({ date: '2020-02-01' })
                );
                const { analyst: a } = await full();
                expect(a.nextEarningsDate).toBe(FMP_DATE);
                expect(a).not.toHaveProperty('earningsSession');
                expect(a).not.toHaveProperty('earningsDateAlt');
            });

            it('Yahoo가 추정이면 승격하지 않는다', async () => {
                getNextEarningsSchedule.mockResolvedValue(schedule(null));
                getAnalystViews.mockResolvedValue(
                    confirmed({ isEstimate: true, session: null })
                );
                const { analyst: a } = await full();
                expect(a.nextEarningsDate).toBe(FMP_DATE);
            });

            it('Yahoo가 isEstimate 모름(null)이면 승격하지 않는다', async () => {
                getNextEarningsSchedule.mockResolvedValue(schedule(null));
                getAnalystViews.mockResolvedValue(
                    confirmed({ isEstimate: null, session: null })
                );
                const { analyst: a } = await full();
                expect(a.nextEarningsDate).toBe(FMP_DATE);
                expect(a.earningsDateAlt).toMatchObject({ date: ALT_DATE });
            });

            it('FMP 일정 행이 아예 없으면 증명할 기준이 없어 아무것도 바꾸지 않는다', async () => {
                getNextEarningsSchedule.mockResolvedValue(null);
                getAnalystViews.mockResolvedValue(confirmed());
                const { analyst: a } = await full();
                expect(a.nextEarningsDate).toBeNull();
                expect(a).not.toHaveProperty('earningsSession');
            });
        });

        it.each([
            ['같은 날짜 · 확정', FMP_DATE, false, 'earningsSession'],
            ['다른 날짜 · 확정(승격)', ALT_DATE, false, 'earningsSession'],
            ['다른 날짜 · 추정', ALT_DATE, true, 'earningsDateAlt'],
        ])(
            '%s: earningsDateAlt와 earningsSession은 절대 함께 나오지 않는다',
            async (_n, date, isEstimate, expectedKey) => {
                getNextEarningsSchedule.mockResolvedValue(schedule(null));
                getAnalystViews.mockResolvedValue(
                    views({
                        earnings: yahooEarnings({
                            date,
                            isEstimate,
                            session: isEstimate ? null : 'after_market',
                        }),
                    })
                );
                const a = await analyst();
                expect('earningsDateAlt' in a && 'earningsSession' in a).toBe(
                    false
                );
                expect(expectedKey in a).toBe(true);
            }
        );

        it('FMP 날짜가 이미 지났고 Yahoo가 추정이면 alt도 승격도 없다', async () => {
            getNextEarningsSchedule.mockResolvedValue({
                ...schedule(null),
                earningsDate: '2020-01-10',
            });
            getAnalystViews.mockResolvedValue(
                views({
                    earnings: yahooEarnings({
                        date: ALT_DATE,
                        isEstimate: true,
                        session: null,
                    }),
                })
            );
            const a = await analyst();
            expect(a).not.toHaveProperty('earningsDateAlt');
            expect(a).not.toHaveProperty('earningsSession');
            expect(a.nextEarningsDate).toBe('2020-01-10');
        });

        it('Yahoo 실적 힌트가 없으면 지금과 같다', async () => {
            getNextEarningsSchedule.mockResolvedValue(schedule(null));
            const a = await analyst();
            expect(a.earningsDateConfirmed).toBeNull();
            expect(a.earningsDateNote).toBe(earningsDateNoteFor(null));
            expect(a).not.toHaveProperty('earningsDateAlt');
        });
    });
});
