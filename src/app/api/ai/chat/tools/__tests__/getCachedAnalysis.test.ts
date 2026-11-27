import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    peekAnalysis,
    peekOverall,
    findByUserAndSymbol,
    findBySymbol,
    findRecentForPrompt,
    profile,
    getQuote,
    getCachedBars,
    assetInfo,
} = vi.hoisted(() => ({
    peekAnalysis: vi.fn(),
    peekOverall: vi.fn(),
    findByUserAndSymbol: vi.fn(),
    findBySymbol: vi.fn(),
    findRecentForPrompt: vi.fn(),
    profile: vi.fn(),
    getQuote: vi.fn(),
    getCachedBars: vi.fn(),
    assetInfo: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        peekAnalysisCache: peekAnalysis,
        peekOverallAnalysisCache: peekOverall,
    };
});
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn(function () {
        return { findRecentForPrompt };
    }),
}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn(function () {
        return { findByUserAndSymbol };
    }),
}));
vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: vi.fn(function () {
        return { findBySymbol };
    }),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/entities/ticker/server/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import {
    buildPlanCheck,
    measuredBaseRateFor,
    TIER_CONFIG,
} from '@y0ngha/siglens-core';
import {
    getCachedAnalysisTool,
    withLevelLadder,
} from '@/app/api/ai/chat/tools/getCachedAnalysis';
import { projectTechnicalAnalysis } from '@/app/api/ai/chat/tools/projectTechnicalAnalysis';
import { SINCE_EARLIER_NOTE } from '@/app/api/ai/chat/tools/sinceEarlier';
import { CACHED_ANALYSIS_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { QUOTE_LOOKUP_TIMEOUT_MS } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    analyzedAfterClose,
    earlierProjection,
    rallyBars,
    tradingDateOf,
} from './fixtures/sinceEarlier';

const mockSessionSpecFor = vi.mocked(sessionSpecFor);
const US_EQUITY_SESSION = {
    kind: 'scheduled' as const,
    timeZone: 'America/New_York',
    openMinute: 570,
    closeMinute: 960,
    weekendDays: [0, 6],
};
const KR_EQUITY_SESSION = {
    kind: 'scheduled' as const,
    timeZone: 'Asia/Seoul',
    openMinute: 540,
    closeMinute: 930,
    weekendDays: [0, 6],
};

const ctx = {
    userId: 'u1',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
// free/게스트는 프리웜 스냅샷(free 등급 생성)과 등급이 같아 공개 폴백을 그대로 받는다.
const freeCtx = { ...ctx, tier: 'free' as const };
const guestCtx = { ...ctx, userId: 'guest:abc', tier: 'free' as const };
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

const technicalCachedResult = {
    result: {
        summary: 'sum',
        trend: 'bullish',
        riskLevel: 'low',
        keyLevels: {},
        priceTargets: {},
    },
    lockedInfoDepth: [],
};

describe('getCachedAnalysisTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findByUserAndSymbol.mockResolvedValue(null);
        findBySymbol.mockResolvedValue([]);
        findRecentForPrompt.mockResolvedValue([]);
        peekAnalysis.mockResolvedValue(null);
        peekOverall.mockResolvedValue(null);
        // `sinceAnalysis`'s price lookup (spec §3.2): no price reachable by
        // default, so `sinceAnalysis` is omitted unless a test opts in —
        // keeps every pre-existing assertion below unaffected.
        profile.mockResolvedValue('us-equity');
        mockSessionSpecFor.mockReturnValue(US_EQUITY_SESSION);
        getQuote.mockResolvedValue(undefined);
        getCachedBars.mockResolvedValue({ bars: [], indicators: { ma: {} } });
        assetInfo.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('technical: redis peek hit → source redis + analysis.summary', async () => {
        peekAnalysis.mockResolvedValue({
            result: {
                summary: 'sum',
                trend: 'bullish',
                riskLevel: 'low',
                keyLevels: {},
                priceTargets: {},
                analyzedAt: '2026-09-01T00:00:00.000Z',
            },
            lockedInfoDepth: [],
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            rt
        )) as {
            found: boolean;
            source: string;
            analysis: { summary: string };
            personalized: boolean;
        };
        expect(r.found).toBe(true);
        expect(r.source).toBe('redis');
        expect(r.analysis.summary).toBe('sum');
        expect(r.personalized).toBe(false);
    });

    it('technical: redis peek hit → 감지된 패턴/전략/캔들패턴이 analysis에 함께 노출된다', async () => {
        peekAnalysis.mockResolvedValue({
            result: {
                summary: 'sum',
                trend: 'bullish',
                riskLevel: 'low',
                keyLevels: {},
                priceTargets: {},
                analyzedAt: '2026-09-01T00:00:00.000Z',
                patternSummaries: [
                    {
                        id: 'p1',
                        patternName: 'head_and_shoulders',
                        skillName: 'chart-pattern',
                        detected: true,
                        trend: 'bearish',
                        summary: '헤드앤숄더 패턴이 감지되었습니다.',
                        confidenceWeight: 0.9,
                    },
                    {
                        id: 'p2',
                        patternName: 'undetected',
                        skillName: 'chart-pattern',
                        detected: false,
                        trend: 'bullish',
                        summary: 'n/a',
                        confidenceWeight: 0.99,
                    },
                ],
                strategyResults: [
                    {
                        id: 's1',
                        strategyName: 'trend-following',
                        trend: 'bullish',
                        summary: '추세 추종 전략 매수 우위.',
                        confidenceWeight: 0.7,
                    },
                ],
                candlePatterns: [
                    {
                        id: 'c1',
                        patternName: 'bullish_engulfing',
                        detected: true,
                        trend: 'bullish',
                        summary: '상승 장악형 캔들이 감지되었습니다.',
                    },
                ],
            },
            lockedInfoDepth: [],
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            rt
        )) as {
            analysis: {
                patterns: { name: string }[];
                strategies: { name: string }[];
                candlePatterns: { name: string }[];
            };
        };
        // The stored card predates `baseRate`: it gets the same daily table row the panel
        // shows (default timeframe 1Day), not a stored value it never had.
        const rate = measuredBaseRateFor(
            'chart_pattern',
            'head_and_shoulders',
            '1Day'
        );
        expect(rate).not.toBeNull();
        expect(r.analysis.patterns).toEqual([
            {
                name: 'head_and_shoulders',
                trend: 'bearish',
                baseRate: {
                    eventShare: rate?.eventShare,
                    placeboShare: rate?.placeboShare,
                    n: rate?.n,
                    verdict: rate?.verdict,
                    pooled: false,
                },
                summary: '헤드앤숄더 패턴이 감지되었습니다.',
            },
        ]);
        expect(r.analysis.strategies).toEqual([
            {
                name: 'trend-following',
                trend: 'bullish',
                summary: '추세 추종 전략 매수 우위.',
            },
        ]);
        expect(r.analysis.candlePatterns).toEqual([
            {
                name: 'bullish_engulfing',
                trend: 'bullish',
                summary: '상승 장악형 캔들이 감지되었습니다.',
            },
        ]);
    });

    it('technical: redis peek hit → 예산 초과 시 registry의 front-cut preview로 뭉개지지 않고 구조화된 채로 절단된다', async () => {
        // 패턴/전략/캔들패턴 각각을 5개(캡 상한)까지, 각각 긴 한글 요약을
        // 실어 CACHED_ANALYSIS_MAX_CHARS(16,000)를 확실히 넘긴다 —
        // `fitTechnicalAnalysis`가 이 Redis 경로에도 적용되지 않으면
        // registry의 `truncateToolResult`가 전체 페이로드를
        // `{truncated, preview}`로 뭉개 keyLevels/priceTargets까지 잃는다.
        const longSummary = (label: string) =>
            `${label} 패턴/전략에 대한 상세한 한글 해설이 이어집니다. `.repeat(
                40
            );
        peekAnalysis.mockResolvedValue({
            result: {
                summary: '요약. '.repeat(200),
                trend: 'bullish',
                riskLevel: 'low',
                keyLevels: { support: [100, 95, 90], resistance: [110, 115] },
                priceTargets: { bullish: 130, bearish: 85 },
                analyzedAt: '2026-09-01T00:00:00.000Z',
                patternSummaries: Array.from({ length: 5 }, (_, i) => ({
                    id: `p${i}`,
                    patternName: `pattern-${i}`,
                    skillName: 'chart-pattern',
                    detected: true,
                    trend: 'bullish',
                    summary: longSummary(`패턴${i}`),
                    confidenceWeight: 0.9 - i * 0.1,
                })),
                strategyResults: Array.from({ length: 5 }, (_, i) => ({
                    id: `s${i}`,
                    strategyName: `strategy-${i}`,
                    trend: 'bullish',
                    summary: longSummary(`전략${i}`),
                    confidenceWeight: 0.8 - i * 0.1,
                })),
                candlePatterns: Array.from({ length: 5 }, (_, i) => ({
                    id: `c${i}`,
                    patternName: `candle-${i}`,
                    detected: true,
                    trend: 'bullish',
                    summary: longSummary(`캔들${i}`),
                })),
            },
            lockedInfoDepth: [],
        });

        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            rt
        )) as {
            found: boolean;
            analysis: {
                keyLevels: unknown;
                priceTargets: unknown;
                patterns: unknown[];
                strategies: unknown[];
                candlePatterns: unknown[];
            };
        };

        expect(r).not.toMatchObject({ truncated: true });
        expect(r).not.toHaveProperty('preview');
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            CACHED_ANALYSIS_MAX_CHARS
        );
        expect(r.found).toBe(true);
        expect(r.analysis.keyLevels).toEqual({
            support: [100, 95, 90],
            resistance: [110, 115],
        });
        expect(r.analysis.priceTargets).toEqual({
            bullish: 130,
            bearish: 85,
        });
        // The fit drops trailing list items whole rather than truncating
        // mid-string once the payload can't fit all 5 of each.
        expect(r.analysis.patterns.length).toBeLessThan(5);
        expect(r.analysis.patterns.length).toBeGreaterThan(0);
    });

    it('technical: 보유 종목이면 positionBucket 계산 후 personalized:true, peekAnalysisCache가 버킷 문자열을 받는다', async () => {
        findByUserAndSymbol.mockResolvedValue({ averagePrice: '100' });
        profile.mockResolvedValue('us-equity');
        getQuote.mockResolvedValue({ price: 150 });
        peekAnalysis.mockResolvedValue(technicalCachedResult);

        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            rt
        )) as {
            personalized: boolean;
        };
        expect(r.personalized).toBe(true);
        expect(peekAnalysis).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            undefined,
            rt.analysisModel,
            false,
            ctx.tier,
            TIER_CONFIG,
            expect.any(String),
            ctx.locale,
            { benchmarkSymbol: 'SPY' }
        );
    });

    it('positionBucket 계산 시 holding.fmpSymbol이 있으면 그 값으로 시세를 조회한다', async () => {
        findByUserAndSymbol.mockResolvedValue({
            averagePrice: '100',
            fmpSymbol: 'AAPL34.SA',
        });
        profile.mockResolvedValue('us-equity');
        getQuote.mockResolvedValue({ price: 150 });
        peekAnalysis.mockResolvedValue(technicalCachedResult);

        await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            rt
        );
        expect(getQuote).toHaveBeenCalledWith('AAPL34.SA');
    });

    it('시세 조회가 throw해도 캐시된 분석은 (개인화 없이) 그대로 반환되고, degrade가 로그된다', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            findByUserAndSymbol.mockResolvedValue({ averagePrice: '100' });
            profile.mockResolvedValue('us-equity');
            getQuote.mockRejectedValue(new Error('FMP 429'));
            peekAnalysis.mockResolvedValue(technicalCachedResult);

            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { found: boolean; personalized: boolean };
            expect(r.found).toBe(true);
            expect(r.personalized).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[AgentTool]',
                'get_cached_analysis',
                'quote lookup failed, degrading',
                { errorName: 'Error', code: undefined }
            );
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it.each([
        ['us-equity', 'AAPL', 'SPY'],
        ['kr-equity', '005930.KS', 'KS11'],
        ['kr-equity', '247540.KQ', 'KQ11'],
        ['crypto', 'BTC-USD', undefined],
    ] as const)(
        'technical peek은 writer와 같은 benchmark 심볼을 넘긴다(%s %s → %s, core 캐시 키 :bm=)',
        async (marketProfile, symbol, benchmarkSymbol) => {
            profile.mockResolvedValue(marketProfile);
            peekAnalysis.mockResolvedValue(null);

            await getCachedAnalysisTool({ symbol, tab: 'technical' }, ctx, rt);

            const call = peekAnalysis.mock.calls.find(c => c[0] === symbol);
            expect(call?.[9]).toEqual({ benchmarkSymbol });
        }
    );

    it('시장 프로필 조회가 던지면 peek을 하지 않고 한 번 로그한 뒤 미스로 접는다(던지지 않는다)', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            profile.mockRejectedValue(new Error('db down'));
            peekAnalysis.mockResolvedValue(technicalCachedResult);

            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { found: boolean };

            expect(r.found).toBe(false);
            expect(peekAnalysis).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[AgentTool]',
                'get_cached_analysis',
                'market profile resolution for the peek key failed, degrading',
                { errorName: 'Error', code: undefined }
            );
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('시세 조회가 멈춰도 타임아웃 내에 버킷 없이 진행된다 (fake timers)', async () => {
        vi.useFakeTimers();
        findByUserAndSymbol.mockResolvedValue({ averagePrice: '100' });
        profile.mockResolvedValue('us-equity');
        getQuote.mockImplementation(() => new Promise(() => {})); // never resolves
        peekAnalysis.mockResolvedValue(technicalCachedResult);

        const resultPromise = getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            rt
        ) as Promise<{ found: boolean; personalized: boolean }>;
        // Two sequential 5s quote timeouts now, not one parallel pair —
        // `positionBucketFor` resolves first (its own bounded
        // quote race), THEN — only after a confirmed cache hit —
        // `priceNowFor` starts its own separate bounded quote race. A single
        // 5s advance no longer covers both; sweep 10s so the second timer
        // (scheduled only after the first fires) falls inside the same call.
        await vi.advanceTimersByTimeAsync(QUOTE_LOOKUP_TIMEOUT_MS * 2);
        const r = await resultPromise;
        expect(r.found).toBe(true);
        expect(r.personalized).toBe(false);
    });

    it('technical: redis miss → snapshot으로 폴백', async () => {
        findBySymbol.mockResolvedValue([
            {
                tab: 'technical',
                generatedAt: new Date('2026-09-01'),
                model: 'm',
                plain: 'p',
                content: { x: 1 },
            },
        ]);
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            freeCtx,
            rt
        )) as {
            found: boolean;
            source: string;
        };
        expect(r.found).toBe(true);
        expect(r.source).toBe('snapshot');
    });

    it('technical snapshot: redis miss여도 봉 기준 staleness를 쓴다(나이 규칙 아님)', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'));
        const generatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days — beyond the 24h age rule, within 7d hard cap
        findBySymbol.mockResolvedValue([
            {
                tab: 'technical',
                generatedAt,
                model: 'm',
                plain: 'p',
                content: { x: 1 },
            },
        ]);
        // No newer bars at all — the age-only rule would already say stale
        // (2 days > 24h), so a `stale: false` result here can only come from
        // the bar-based rule actually running through the snapshot branch.
        // Stamped at UTC midnight of `generatedAt`'s OWN ET trading date
        // (the real daily-bar stamping convention `barTradingDateUtc`
        // relies on) — NOT a naive `generatedAt - 1h` offset, which flips to
        // a DIFFERENT ET trading day whenever the wall clock happens to sit
        // in the 00:00–05:00Z window, making this fixture correct
        // regardless of what instant the clock above is frozen at.
        getCachedBars.mockResolvedValue({
            bars: [
                {
                    time:
                        Date.parse(
                            `${zonedDate(generatedAt, 'America/New_York')}T00:00:00Z`
                        ) / 1000,
                    open: 1,
                    high: 1,
                    low: 1,
                    close: 1,
                    volume: 1,
                },
            ],
            indicators: { ma: {} },
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            freeCtx,
            rt
        )) as { found: boolean; source: string; stale: boolean };
        expect(r.source).toBe('snapshot');
        expect(r.stale).toBe(false);
        expect(getCachedBars).toHaveBeenCalled();
    });

    it('non-technical/overall snapshot: 봉 기준 staleness를 쓰지 않고 나이 규칙(news 기본 7일)을 유지한다', async () => {
        // `STALE_AFTER_MS` has no 'news' entry → falls back to the 7-day
        // `DEFAULT_STALE_MS`, unlike technical/overall's 24h rule. 8 days
        // old confirms the age-only (not bar-based) path is still in effect.
        const generatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        findBySymbol.mockResolvedValue([
            {
                tab: 'news',
                locale: 'ko',
                generatedAt,
                model: 'm',
                plain: 'p',
                content: { x: 1 },
            },
        ]);
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'news' },
            ctx,
            rt
        )) as { source: string; stale: boolean };
        expect(r.source).toBe('snapshot');
        expect(r.stale).toBe(true);
        expect(getCachedBars).not.toHaveBeenCalled();
    });

    it('snapshot은 언어와 무관하게 찾고(anyLocale), 원문 → 평이화 순서와 원문 언어를 함께 넘긴다', async () => {
        findBySymbol.mockResolvedValue([
            {
                tab: 'news',
                locale: 'ko',
                generatedAt: new Date('2026-09-11'),
                model: 'm',
                plain: '쉬운 설명',
                content: { summary: '원문' },
            },
        ]);
        const r = (await getCachedAnalysisTool(
            { symbol: 'TSLA', tab: 'news' },
            { ...ctx, locale: 'ja' },
            rt
        )) as Record<string, unknown>;
        expect(findBySymbol).toHaveBeenCalledWith('TSLA', 'ja', {
            anyLocale: true,
        });
        expect(r).toMatchObject({
            source: 'snapshot',
            contentLanguage: 'ko',
            analysis: { summary: '원문' },
            plain: '쉬운 설명',
        });
        const keys = Object.keys(r);
        expect(keys.indexOf('analysis')).toBeLessThan(keys.indexOf('plain'));
    });

    it('overall: peekOverallAnalysisCache hit → 신선도 불명은 null로 표현한다, getAssetInfo 조회 없음', async () => {
        peekOverall.mockResolvedValue({
            headlineKo: 'h',
            technicalBulletsKo: [],
            fundamentalBulletsKo: [],
            newsBulletsKo: [],
            optionsBulletsKo: [],
            integratedConclusionKo: 'c',
            scenarios: [],
            riskFactorsKo: [],
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'overall' },
            ctx,
            rt
        )) as {
            found: boolean;
            generatedAt: string | null;
            stale: boolean | null;
            analysis: { headline: string };
        };
        expect(r.found).toBe(true);
        expect(r.analysis.headline).toBe('h');
        expect(r.generatedAt).toBeNull();
        expect(r.stale).toBeNull();
        expect(peekOverall).toHaveBeenCalledWith(
            'AAPL',
            'AAPL',
            '1Day',
            rt.analysisModel,
            false,
            ctx.tier,
            TIER_CONFIG,
            ctx.locale
        );
    });

    it('overall: Redis 적중 결과에 수급·재무 요약을 싣고, 수급 요약이 없는 결과는 빈 배열로 준다', async () => {
        const base = {
            headlineKo: 'h',
            technicalBulletsKo: [],
            fundamentalBulletsKo: [],
            newsBulletsKo: [],
            optionsBulletsKo: [],
            financialsBulletsKo: ['재무 요점'],
            integratedConclusionKo: 'c',
            scenarios: [],
            riskFactorsKo: [],
        };
        peekOverall.mockResolvedValueOnce({
            ...base,
            investorFlowsBulletsKo: ['수급 요점'],
        });
        const withFlows = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'overall' },
            ctx,
            rt
        )) as { analysis: Record<string, unknown> };
        expect(withFlows.analysis.investorFlows).toEqual(['수급 요점']);
        expect(withFlows.analysis.financials).toEqual(['재무 요점']);

        peekOverall.mockResolvedValueOnce(base);
        const withoutFlows = (await getCachedAnalysisTool(
            { symbol: 'BTCUSD', tab: 'overall' },
            ctx,
            rt
        )) as { analysis: Record<string, unknown> };
        expect(withoutFlows.analysis.investorFlows).toEqual([]);
    });

    it('fundamental 탭은 캐시·스냅샷 다 miss면 history 조회 없이 found:false + hint', async () => {
        const r = await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'fundamental' },
            ctx,
            rt
        );
        expect(r).toEqual({
            found: false,
            tab: 'fundamental',
            symbol: 'AAPL',
            hint: 'call run_fresh_analysis',
        });
        expect(findRecentForPrompt).not.toHaveBeenCalled();
    });

    it('technical 탭은 모두 miss면 history digest로 폴백', async () => {
        findRecentForPrompt.mockResolvedValue([
            {
                generatedAt: new Date('2026-08-01'),
                trend: 'bullish',
                riskLevel: 'low',
            },
        ]);
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            freeCtx,
            rt
        )) as {
            found: boolean;
            source: string;
        };
        expect(r.found).toBe(true);
        expect(r.source).toBe('history');
        // 챗 폴백은 "지금 존재하는 가장 최신 행"을 원한다 — eviction-loop
        // 방지용 generatedBeforeMs 제외를 건너뛰어야 한다(그 제외는 core 캐시
        // 키 fingerprint 용도).
        expect(findRecentForPrompt).toHaveBeenCalledWith({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            includeCurrentWindow: true,
        });
    });

    it('history: 봉 기준 staleness를 쓴다(나이 규칙 아님)', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'));
        const generatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days — beyond 24h age rule, within 7d hard cap
        findRecentForPrompt.mockResolvedValue([
            { generatedAt, trend: 'bullish', riskLevel: 'low' },
        ]);
        // No newer bars — a `stale: false` result can only come from the
        // bar-based rule actually running through the history branch.
        // Stamped at UTC midnight of `generatedAt`'s OWN ET trading date —
        // see the technical-snapshot test above for why this must be
        // trading-date-aware rather than a naive `-1h` offset.
        getCachedBars.mockResolvedValue({
            bars: [
                {
                    time:
                        Date.parse(
                            `${zonedDate(generatedAt, 'America/New_York')}T00:00:00Z`
                        ) / 1000,
                    open: 1,
                    high: 1,
                    low: 1,
                    close: 1,
                    volume: 1,
                },
            ],
            indicators: { ma: {} },
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            freeCtx,
            rt
        )) as { source: string; stale: boolean };
        expect(r.source).toBe('history');
        expect(r.stale).toBe(false);
        expect(getCachedBars).toHaveBeenCalled();
    });

    it('전부 miss면 found:false + hint, quote/bars 조회는 전혀 일어나지 않는다', async () => {
        const r = await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            freeCtx,
            rt
        );
        expect(r).toEqual({
            found: false,
            tab: 'technical',
            symbol: 'AAPL',
            hint: 'call run_fresh_analysis',
        });
        // `priceNowFor` now only starts after a confirmed redis cache hit,
        // and `isStaleByBars` only runs on a hit or a snapshot/history row —
        // a total miss must waste neither a quote nor a bars lookup.
        expect(getQuote).not.toHaveBeenCalled();
        expect(getCachedBars).not.toHaveBeenCalled();
    });

    describe('bar 기반 staleness (spec §3.2, B4)', () => {
        const barAt = (unixSeconds: number) => ({
            time: unixSeconds,
            open: 100,
            high: 101,
            low: 99,
            close: 100,
            volume: 100,
        });

        // EVERY test below freezes the clock close to its own
        // `generatedAt` (via `vi.setSystemTime`), so `isStaleByBars`'s 7-day
        // HARD CAP (`Date.now() - generatedAt.getTime() > STALE_HARD_CAP_MS`)
        // never fires before the bar/trading-date rule gets a chance to
        // decide. Without this, a fixed `generatedAt` silently ages past 7
        // days as real time passes and the test starts passing for the WRONG
        // reason (the cap forcing `stale: true` regardless of what the bar
        // rule — or a regression in it — would have said), masking a broken
        // rule. Only the explicit hard-cap test below intentionally exceeds
        // the cap.
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it("timeframe '1Day' 임계치 1: generatedAt 이후 새 봉이 1개 이상이면 stale", async () => {
            const generatedAt = new Date('2026-09-10T00:00:00.000Z');
            vi.setSystemTime(generatedAt);
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: generatedAt.toISOString(),
                },
                lockedInfoDepth: [],
            });
            getCachedBars.mockResolvedValue({
                bars: [
                    barAt(generatedAt.getTime() / 1000 - 3600), // older
                    barAt(generatedAt.getTime() / 1000 + 3600), // newer — 1 new bar
                ],
                indicators: { ma: {} },
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { stale: boolean };
            expect(r.stale).toBe(true);
        });

        it("timeframe '1Day' 새 봉이 없으면 stale 아님 (하루 고정 규칙이 아니라 봉 개수 규칙)", async () => {
            // Fixed mid-UTC-day system time (not real `new Date()`) — '1Day'
            // staleness compares ET trading dates, so a
            // real-clock run near the UTC/ET date-boundary window
            // (00:00–04:59Z, ET's evening of the PREVIOUS calendar day)
            // would make this test flaky depending on when it happens to run.
            vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
            const generatedAt = new Date(); // just generated
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: generatedAt.toISOString(),
                },
                lockedInfoDepth: [],
            });
            getCachedBars.mockResolvedValue({
                bars: [barAt(generatedAt.getTime() / 1000 - 3600)],
                indicators: { ma: {} },
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { stale: boolean };
            expect(r.stale).toBe(false);
        });

        it('7일 하드 캡(명시적 경계 테스트): 새 봉이 없어도 age가 7일을 넘으면 stale', async () => {
            const now = new Date('2026-09-19T00:00:00.000Z');
            vi.setSystemTime(now);
            const generatedAt = new Date(
                now.getTime() - 8 * 24 * 60 * 60 * 1000
            ); // > 7-day cap
            // Resolved via quote so `sinceAnalysis`'s own (unrelated) bars
            // fallback never fires — isolates the staleness assertion below.
            getQuote.mockResolvedValue({ price: 100 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: generatedAt.toISOString(),
                },
                lockedInfoDepth: [],
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { stale: boolean };
            expect(r.stale).toBe(true);
            // Hard cap short-circuits before ever touching bars.
            expect(getCachedBars).not.toHaveBeenCalled();
        });

        it('bars 로드 실패 시 나이 기반 규칙으로 폴백하고, 두 degrade(stale-by-bars/last-close)가 모두 로그된다', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                const now = new Date('2026-09-19T00:00:00.000Z');
                vi.setSystemTime(now);
                const generatedAt = new Date(
                    now.getTime() - 2 * 24 * 60 * 60 * 1000
                ); // 2 days — beyond the 24h age rule, within the 7-day cap
                peekAnalysis.mockResolvedValue({
                    result: {
                        ...technicalCachedResult.result,
                        analyzedAt: generatedAt.toISOString(),
                    },
                    lockedInfoDepth: [],
                });
                getCachedBars.mockRejectedValue(new Error('bars cache down'));
                const r = (await getCachedAnalysisTool(
                    { symbol: 'AAPL', tab: 'technical' },
                    ctx,
                    rt
                )) as { stale: boolean };
                expect(r.stale).toBe(true); // 24h age fallback rule
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    '[AgentTool]',
                    'get_cached_analysis',
                    'stale-by-bars check failed, degrading',
                    { errorName: 'Error', code: undefined }
                );
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                    '[AgentTool]',
                    'get_cached_analysis',
                    'last-close lookup failed, degrading',
                    { errorName: 'Error', code: undefined }
                );
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });

        it("timeframe '1Day': 봉이 빈 배열이면 나이 기반 규칙으로 폴백한다", async () => {
            const now = new Date('2026-09-19T00:00:00.000Z');
            vi.setSystemTime(now);
            const generatedAt = new Date(
                now.getTime() - 2 * 24 * 60 * 60 * 1000
            ); // 2 days — beyond 24h age rule, within the 7-day cap
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: generatedAt.toISOString(),
                },
                lockedInfoDepth: [],
            });
            getCachedBars.mockResolvedValue({
                bars: [],
                indicators: { ma: {} },
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { stale: boolean };
            expect(r.stale).toBe(true); // 24h age fallback rule
        });

        it("timeframe '1Day': ET 저녁에 생성된 분석은 다음날 UTC 자정 봉을 새 거래일로 센다 (analysisPrice가 아니라 트레이딩 데이트 비교)", async () => {
            // generatedAt = 2026-09-17T21:30 ET (EDT, UTC-4) = 2026-09-18T01:30:00.000Z.
            // A raw-instant comparison (`b.time > generatedAtSec`) would miss
            // the 9/18 bar entirely — it is stamped at 2026-09-18T00:00:00Z,
            // which is EARLIER than 01:30Z, so it would read as "not newer"
            // even though it is a whole new ET trading day. The fix compares
            // TRADING DATES: ET calendar date of generatedAt ('2026-09-17')
            // vs the bar's own UTC date ('2026-09-18') — 9/18 > 9/17.
            const generatedAt = new Date('2026-09-18T01:30:00.000Z');
            // Freeze "now" AT generatedAt — without this, the 7-day
            // hard cap would eventually force `stale: true`
            // regardless of the trading-date rule below once real time moves
            // far enough past this fixed date, masking a regression in it.
            vi.setSystemTime(generatedAt);
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: generatedAt.toISOString(),
                },
                lockedInfoDepth: [],
            });
            getCachedBars.mockResolvedValue({
                bars: [
                    barAt(Date.parse('2026-09-17T00:00:00.000Z') / 1000), // same trading day as the analysis — must NOT count
                    barAt(Date.parse('2026-09-18T00:00:00.000Z') / 1000), // next trading day — must count
                ],
                indicators: { ma: {} },
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { stale: boolean };
            expect(r.stale).toBe(true);
        });

        it("timeframe '1Day' (KR case): 같은 KST 거래일의 UTC-자정 봉은 새 거래일로 세지 않는다", async () => {
            profile.mockResolvedValue('kr-equity');
            mockSessionSpecFor.mockReturnValue(KR_EQUITY_SESSION);
            // generatedAt = 2026-09-18T00:30 KST (UTC+9) = 2026-09-17T15:30:00.000Z.
            // Under the OLD raw-instant comparison, the 9/18 UTC-midnight bar
            // (2026-09-18T00:00:00Z) IS later than generatedAtSec
            // (2026-09-17T15:30:00Z), so it would be wrongly counted as a
            // NEW bar even though it is the SAME KST trading day
            // (2026-09-18) the analysis was generated on. Trading-date
            // comparison fixes this: KST calendar date of generatedAt
            // ('2026-09-18') is NOT before the bar's own UTC date
            // ('2026-09-18') — same day, not stale.
            const generatedAt = new Date('2026-09-17T15:30:00.000Z');
            // Freeze "now" AT generatedAt — this test asserts
            // `stale: false`, which the hard cap can never itself
            // cause (it only ever forces `true`), but freezing keeps every
            // test in this block consistent and future-proof against the
            // cap eventually intruding once other assertions are added.
            vi.setSystemTime(generatedAt);
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: generatedAt.toISOString(),
                },
                lockedInfoDepth: [],
            });
            getCachedBars.mockResolvedValue({
                bars: [barAt(Date.parse('2026-09-18T00:00:00.000Z') / 1000)],
                indicators: { ma: {} },
            });
            const r = (await getCachedAnalysisTool(
                { symbol: '005930.KS', tab: 'technical' },
                ctx,
                rt
            )) as { stale: boolean };
            expect(r.stale).toBe(false);
        });

        it('overall: analyzedAt이 있으면 봉 기준 staleness를 계산한다 (core OverallAnalysisResponse.analyzedAt)', async () => {
            const generatedAt = new Date('2026-09-10T00:00:00.000Z');
            // Freeze "now" AT generatedAt — without this, this test
            // silently passes via the 7-day hard cap once real
            // time moves far enough past this fixed date, regardless of
            // whether the 'overall' branch's `isStaleByBars` wiring (as
            // opposed to the age-only `stale()` rule) is even reached — the
            // exact vacuous-test failure mode this freeze closes.
            vi.setSystemTime(generatedAt);
            peekOverall.mockResolvedValue({
                headlineKo: 'h',
                technicalBulletsKo: [],
                fundamentalBulletsKo: [],
                newsBulletsKo: [],
                optionsBulletsKo: [],
                integratedConclusionKo: 'c',
                scenarios: [],
                riskFactorsKo: [],
                analyzedAt: generatedAt.toISOString(),
            });
            getCachedBars.mockResolvedValue({
                bars: [barAt(generatedAt.getTime() / 1000 + 3600)],
                indicators: { ma: {} },
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'overall' },
                ctx,
                rt
            )) as { generatedAt: string | null; stale: boolean | null };
            expect(r.generatedAt).toBe(generatedAt.toISOString());
            expect(r.stale).toBe(true);
        });
    });

    describe('sinceAnalysis (spec §3.2, B4)', () => {
        it('quote가 있으면 analysisPrice/priceNow/movePct/levelsBroken/levelLadder를 계산하고 planNow는 buildPlanCheck로 채워진다', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    summary: 'sum',
                    trend: 'bullish',
                    riskLevel: 'low',
                    keyLevels: {
                        support: [
                            { price: 100, reason: 'r' }, // below priceNow=120 → still support (a `below` rung)
                            { price: 125, reason: 'r' }, // ABOVE priceNow=120 → broken (fell through); lands in `above` whatever its role
                        ],
                        resistance: [
                            { price: 115, reason: 'r' }, // below priceNow=120 → broken (broke above); lands in `below` whatever its role
                            { price: 130, reason: 'r' }, // above priceNow=120 → an `above` rung
                            { price: 140, reason: 'r' }, // further above → a farther `above` rung
                        ],
                    },
                    priceTargets: {},
                    analyzedAt: '2026-09-01T00:00:00.000Z',
                    actionRecommendation: {
                        planCheck: { currentPrice: 100 },
                        entryPrices: [95, 105],
                        stopLoss: 90,
                        takeProfitPrices: [130, 150],
                    },
                },
                lockedInfoDepth: [],
            });

            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as {
                sinceAnalysis: {
                    analysisPrice: number | null;
                    priceNow: number;
                    movePct: number | null;
                    levelsBroken: Array<{
                        kind: string;
                        price: number;
                    }>;
                    levelLadder: {
                        above: Array<{ price: number }>;
                        below: Array<{ price: number }>;
                    };
                    planNow: {
                        riskReward: number | null;
                        belowStopLoss: boolean;
                        exceedsEntryZone: boolean;
                    } | null;
                };
            };
            expect(r.sinceAnalysis.analysisPrice).toBe(100);
            expect(r.sinceAnalysis.priceNow).toBe(120);
            expect(r.sinceAnalysis.movePct).toBe(20); // (120-100)/100*100
            expect(r.sinceAnalysis.levelsBroken).toEqual(
                expect.arrayContaining([
                    { kind: 'support', price: 125 },
                    { kind: 'resistance', price: 115 },
                ])
            );
            expect(r.sinceAnalysis.levelsBroken).toHaveLength(2);
            // The side comes from the price, never from the role: the broken support (125) is the
            // nearest level ABOVE 120, the broken resistance (115) the nearest BELOW; the stop (90) is a rung too.
            expect(r.sinceAnalysis.levelLadder.above.map(l => l.price)).toEqual(
                [125, 130, 140]
            );
            expect(r.sinceAnalysis.levelLadder.below.map(l => l.price)).toEqual(
                [115, 100, 90]
            );
            expect(r.sinceAnalysis).not.toHaveProperty('nearestSupport');
            expect(r.sinceAnalysis).not.toHaveProperty('nearestResistance');
            // entryPrices=[95,105] → entry mid 100; entryZoneTop=105.
            // priceNow=120 > 105 (the zone top, exact edge) → exceedsEntryZone; stopLoss=90 < priceNow → not belowStopLoss.
            // riskRewardAtCurrent = (nearest target above 120=130 - 120) / (120 - 90) = 10/30.
            const expected = buildPlanCheck(
                {
                    positionAnalysis: '',
                    entry: '',
                    exit: '',
                    riskReward: '',
                    entryPrices: [95, 105],
                    stopLoss: 90,
                    takeProfitPrices: [130, 150],
                },
                120,
                100
            )!;
            expect(r.sinceAnalysis.planNow).toEqual({
                riskReward: expected.riskRewardAtCurrent,
                belowStopLoss: expected.belowStopLoss,
                exceedsEntryZone: expected.exceedsEntryZone,
            });
            expect(r.sinceAnalysis.planNow!.exceedsEntryZone).toBe(true);
            expect(r.sinceAnalysis.planNow!.belowStopLoss).toBe(false);
            expect(r.sinceAnalysis.planNow!.riskReward).toBeCloseTo(10 / 30, 6);
        });

        it('planNow: entryPrices로 core planEntryPrice가 계산한 평균 진입가로 무효 손절(진입가 이상)을 무력화한다(planEntryPrice 배선)', async () => {
            // analysisPrice(planCheck.currentPrice)가 없어 fallback도 null —
            // entryPrice는 오직 core `planEntryPrice`가 entryPrices=[95,105]의
            // 평균(100)으로 구해야만 나온다. stopLoss=150은 그 100보다 높아
            // (entryPrice 이상) buildPlanCheck의 무효 손절 규칙으로 닐링되고,
            // 닐링되면 belowStopLoss는 항상 false다. entryPrice 배선이 깨져
            // undefined로 넘어가면(예: 되돌린 로컬 `entryPriceFor` 제거 버그)
            // 무효화 규칙이 발동하지 않아 stopLoss=150이 그대로 남고
            // priceNow(120) <= 150이라 belowStopLoss가 true로 뒤집힌다.
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    summary: 'sum',
                    trend: 'bullish',
                    riskLevel: 'low',
                    keyLevels: { support: [], resistance: [] },
                    priceTargets: {},
                    analyzedAt: '2026-09-01T00:00:00.000Z',
                    actionRecommendation: {
                        positionAnalysis: '',
                        entry: '',
                        exit: '',
                        riskReward: '',
                        entryPrices: [95, 105],
                        stopLoss: 150,
                        takeProfitPrices: [200],
                    },
                },
                lockedInfoDepth: [],
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as {
                sinceAnalysis: {
                    planNow: { belowStopLoss: boolean } | null;
                };
            };
            expect(r.sinceAnalysis.planNow?.belowStopLoss).toBe(false);
        });

        it('planNow: actionRecommendation이 없으면 null', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue(technicalCachedResult);
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { sinceAnalysis: { planNow: unknown } };
            expect(r.sinceAnalysis.planNow).toBeNull();
        });

        it('N19: priceNow 위의 분석 지지선은 above 칸에, 아래의 저항선은 below 칸에 놓인다 (역할이 아니라 가격으로 쪽을 가른다)', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    keyLevels: {
                        support: [{ price: 125, reason: 'r' }],
                        resistance: [{ price: 115, reason: 'r' }],
                    },
                    analyzedAt: '2026-09-01T00:00:00.000Z',
                },
                lockedInfoDepth: [],
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as {
                sinceAnalysis: {
                    levelLadder: {
                        above: Array<{ price: number; sources: string[] }>;
                        below: Array<{ price: number; sources: string[] }>;
                    };
                };
            };
            expect(r.sinceAnalysis.levelLadder.above).toMatchObject([
                { price: 125, sources: ['analysis support'] },
            ]);
            expect(r.sinceAnalysis.levelLadder.below).toMatchObject([
                { price: 115, sources: ['analysis resistance'] },
            ]);
        });

        it('분석 레벨도 차트 기준도 없으면 levelLadder 키가 없다', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: '2026-09-01T00:00:00.000Z',
                },
                lockedInfoDepth: [],
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { sinceAnalysis: Record<string, unknown> };
            expect(r.sinceAnalysis).not.toHaveProperty('levelLadder');
        });

        it('가격이 비유한값이거나 0 이하인 레벨은 levelLadder·levelsBroken 어디에도 나타나지 않는다', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    keyLevels: {
                        support: [
                            { price: 0, reason: 'r' },
                            { price: -10, reason: 'r' },
                            { price: Number.NaN, reason: 'r' },
                            { price: 90, reason: 'r' }, // only valid one
                        ],
                        resistance: [
                            { price: 0, reason: 'r' },
                            { price: Number.POSITIVE_INFINITY, reason: 'r' },
                        ],
                    },
                    analyzedAt: '2026-09-01T00:00:00.000Z',
                },
                lockedInfoDepth: [],
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as {
                sinceAnalysis: {
                    levelLadder: {
                        above: unknown[];
                        below: Array<{ price: number }>;
                    };
                    levelsBroken: unknown[];
                };
            };
            expect(r.sinceAnalysis.levelLadder.below.map(l => l.price)).toEqual(
                [90]
            );
            expect(r.sinceAnalysis.levelLadder.above).toEqual([]);
            expect(r.sinceAnalysis.levelsBroken).toEqual([]);
        });

        it('analysisPrice(planCheck) 없으면 null, movePct도 null', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: '2026-09-01T00:00:00.000Z',
                },
                lockedInfoDepth: [],
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { sinceAnalysis: { analysisPrice: null; movePct: null } };
            expect(r.sinceAnalysis.analysisPrice).toBeNull();
            expect(r.sinceAnalysis.movePct).toBeNull();
        });

        it('levelLadder의 distancePct는 (level−price)/price × 100, 소수 2자리 — 위쪽 레벨은 양수, 아래쪽은 음수', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    keyLevels: {
                        support: [{ price: 110, reason: 'r' }],
                        resistance: [{ price: 130, reason: 'r' }],
                    },
                    analyzedAt: '2026-09-01T00:00:00.000Z',
                },
                lockedInfoDepth: [],
            });
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as {
                sinceAnalysis: {
                    levelLadder: {
                        above: Array<{ price: number; distancePct: number }>;
                        below: Array<{ price: number; distancePct: number }>;
                    };
                };
            };
            // (130-120)/120*100 = 8.3333 → 8.33; (110-120)/120*100 → -8.33.
            expect(r.sinceAnalysis.levelLadder.above).toMatchObject([
                { price: 130, distancePct: 8.33 },
            ]);
            expect(r.sinceAnalysis.levelLadder.below).toMatchObject([
                { price: 110, distancePct: -8.33 },
            ]);
        });

        describe('levelLadder chart references', () => {
            // 30 daily bars: close = 100 + i, high = close + 1, low = close - 1 (i = 0..29), so the whole
            // series (the 52-week window) has high 130 / low 99, and the last 20 bars (i = 10..29) have
            // high 130 / low 109.
            const dailyBars = Array.from({ length: 30 }, (_, i) => ({
                time: Date.UTC(2026, 0, 1 + i) / 1000,
                open: 100 + i,
                high: 101 + i,
                low: 99 + i,
                close: 100 + i,
                volume: 1,
            }));
            const indicators = {
                ma: { 20: [117.5], 50: [112], 200: [] },
            };
            const peekRecent = (timeframe: string) =>
                peekAnalysis.mockResolvedValue({
                    result: {
                        ...technicalCachedResult.result,
                        keyLevels: {
                            support: [{ price: 120, reason: 'r' }],
                            resistance: [],
                        },
                        analyzedAt: new Date().toISOString(),
                        timeframe,
                    },
                    lockedInfoDepth: [],
                });
            type Ladder = {
                above: Array<{ price: number; sources: string[] }>;
                below: Array<{ price: number; sources: string[] }>;
            };

            it('일봉 분석은 52주·20일 고저와 20/50/200일 평균을 사다리에 싣고, 봉은 한 번만 읽는다', async () => {
                getQuote.mockResolvedValue({ price: 125 });
                getCachedBars.mockResolvedValue({
                    bars: dailyBars,
                    indicators,
                });
                peekRecent('1Day');
                const r = (await getCachedAnalysisTool(
                    { symbol: 'AAPL', tab: 'technical' },
                    ctx,
                    rt
                )) as { sinceAnalysis: { levelLadder: Ladder } };
                const { above, below } = r.sinceAnalysis.levelLadder;
                expect(above).toMatchObject([
                    { price: 130, sources: ['52-week high', '20-day high'] },
                ]);
                // cap of 4 per side, nearest first: 120 (analysis), 117.5 (20-day average), 112 (50-day
                // average), 109 (20-day low); 99 (52-week low) is the fifth and not listed. No 200-day average:
                // the series has none.
                expect(below.map(l => l.price)).toEqual([120, 117.5, 112, 109]);
                expect(below[1]?.sources).toEqual(['20-day average']);
                // One bars read served both the staleness check and the ladder.
                expect(getCachedBars).toHaveBeenCalledTimes(1);
            });

            it('일봉이 아닌 분석에는 차트 기준(…일 …)을 싣지 않는다', async () => {
                getQuote.mockResolvedValue({ price: 125 });
                getCachedBars.mockResolvedValue({
                    bars: dailyBars,
                    indicators,
                });
                peekRecent('1Hour');
                const r = (await getCachedAnalysisTool(
                    { symbol: 'AAPL', tab: 'technical', timeframe: '1Hour' },
                    ctx,
                    rt
                )) as { sinceAnalysis: { levelLadder: Ladder } };
                const { above, below } = r.sinceAnalysis.levelLadder;
                expect(above).toEqual([]);
                expect(below).toMatchObject([
                    { price: 120, sources: ['analysis support'] },
                ]);
            });

            it('봉 조회가 실패하면 분석 레벨만으로 사다리를 만들고 stale은 나이 규칙으로 폴백한다', async () => {
                getQuote.mockResolvedValue({ price: 125 });
                getCachedBars.mockRejectedValue(new Error('bars down'));
                peekRecent('1Day');
                const r = (await getCachedAnalysisTool(
                    { symbol: 'AAPL', tab: 'technical' },
                    ctx,
                    rt
                )) as {
                    stale: boolean;
                    sinceAnalysis: { levelLadder: Ladder };
                };
                expect(r.stale).toBe(false);
                expect(r.sinceAnalysis.levelLadder.above).toEqual([]);
                expect(r.sinceAnalysis.levelLadder.below).toMatchObject([
                    { price: 120, sources: ['analysis support'] },
                ]);
            });
        });

        it('quote도 last close도 못 구하면 sinceAnalysis 자체가 없다', async () => {
            getQuote.mockResolvedValue(undefined);
            getCachedBars.mockResolvedValue({
                bars: [],
                indicators: { ma: {} },
            });
            peekAnalysis.mockResolvedValue(technicalCachedResult);
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as Record<string, unknown>;
            expect(r).not.toHaveProperty('sinceAnalysis');
        });

        it('quote가 없으면 캐시된 bars의 마지막 종가로 폴백한다', async () => {
            getQuote.mockResolvedValue(undefined);
            getCachedBars.mockResolvedValue({
                bars: [
                    { time: 1, open: 1, high: 1, low: 1, close: 90, volume: 1 },
                    {
                        time: 2,
                        open: 1,
                        high: 1,
                        low: 1,
                        close: 95,
                        volume: 1,
                    },
                ],
                indicators: { ma: {} },
            });
            peekAnalysis.mockResolvedValue(technicalCachedResult);
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { sinceAnalysis: { priceNow: number } };
            expect(r.sinceAnalysis.priceNow).toBe(95); // last bar's close
        });

        it('마지막 종가가 0/음수면(불량 데이터) unknown 취급 — sinceAnalysis 자체가 없다', async () => {
            getQuote.mockResolvedValue(undefined);
            getCachedBars.mockResolvedValue({
                bars: [
                    { time: 1, open: 1, high: 1, low: 1, close: 0, volume: 1 },
                ],
                indicators: { ma: {} },
            });
            peekAnalysis.mockResolvedValue(technicalCachedResult);
            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as Record<string, unknown>;
            expect(r).not.toHaveProperty('sinceAnalysis');
        });

        it('quote price가 0/음수면 unknown 취급하고 bars 폴백으로 넘어간다', async () => {
            getQuote.mockResolvedValue({ price: 0 });
            getCachedBars.mockResolvedValue({
                bars: [
                    { time: 1, open: 1, high: 1, low: 1, close: 88, volume: 1 },
                ],
                indicators: { ma: {} },
            });
            peekAnalysis.mockResolvedValue(technicalCachedResult);
            let r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { sinceAnalysis: { priceNow: number } };
            expect(r.sinceAnalysis.priceNow).toBe(88);

            getQuote.mockResolvedValue({ price: -5 });
            r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { sinceAnalysis: { priceNow: number } };
            expect(r.sinceAnalysis.priceNow).toBe(88);
        });
    });

    describe('fmpSymbol threading (spec §3.2) — same asset-info path get_bars_indicators uses', () => {
        it('technical: staleness bars 조회와 sinceAnalysis 시세 조회 모두 asset.fmpSymbol로 조회한다', async () => {
            assetInfo.mockResolvedValue({
                symbol: 'BRK.A',
                fmpSymbol: 'BRK-A',
            });
            getQuote.mockResolvedValue({ price: 150 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    // Within the 7-day hard cap so `isStaleByBars` actually
                    // reaches the bars fetch instead of short-circuiting.
                    analyzedAt: new Date().toISOString(),
                },
                lockedInfoDepth: [],
            });

            await getCachedAnalysisTool(
                { symbol: 'BRK.A', tab: 'technical' },
                ctx,
                rt
            );

            expect(getQuote).toHaveBeenCalledWith('BRK-A');
            expect(getCachedBars).toHaveBeenCalledWith(
                { getQuote },
                'BRK.A',
                '1Day',
                'BRK-A',
                US_EQUITY_SESSION
            );
        });

        it('getAssetInfo가 throw해도 fmpSymbol 없이(plain symbol로) 진행된다', async () => {
            assetInfo.mockRejectedValue(new Error('db down'));
            getQuote.mockResolvedValue({ price: 150 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    analyzedAt: '2026-09-01T00:00:00.000Z',
                },
                lockedInfoDepth: [],
            });

            const r = (await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'technical' },
                ctx,
                rt
            )) as { found: boolean };
            expect(r.found).toBe(true);
            expect(getQuote).toHaveBeenCalledWith('AAPL');
        });

        it('fundamental/news 등 다른 탭에서는 getAssetInfo를 조회하지 않는다', async () => {
            await getCachedAnalysisTool(
                { symbol: 'AAPL', tab: 'fundamental' },
                ctx,
                rt
            );
            expect(assetInfo).not.toHaveBeenCalled();
        });
    });
});

describe('getCachedAnalysisTool — 회원 호출자 (공개 분석으로 대체하지 않는다)', () => {
    const analysisAt = (analyzedAt: string, summary: string) => ({
        result: {
            summary,
            trend: 'bullish',
            riskLevel: 'low',
            keyLevels: {},
            priceTargets: {},
            analyzedAt,
        },
        lockedInfoDepth: [],
    });
    const snapshotRow = {
        tab: 'technical',
        generatedAt: new Date('2026-10-19T00:00:00.000Z'),
        model: 'm',
        plain: 'p',
        content: { x: 1 },
    };
    // 판별 인자(reasoning = 5번째)로 호출을 찾는다 — 인덱스 단언 금지.
    const peekCallWithReasoning = (reasoning: boolean) =>
        peekAnalysis.mock.calls.find(c => c[4] === reasoning);

    beforeEach(() => {
        vi.clearAllMocks();
        findByUserAndSymbol.mockResolvedValue(null);
        findBySymbol.mockResolvedValue([]);
        findRecentForPrompt.mockResolvedValue([]);
        peekAnalysis.mockResolvedValue(null);
        peekOverall.mockResolvedValue(null);
        profile.mockResolvedValue('us-equity');
        mockSessionSpecFor.mockReturnValue(US_EQUITY_SESSION);
        getQuote.mockResolvedValue(undefined);
        getCachedBars.mockResolvedValue({ bars: [], indicators: { ma: {} } });
        assetInfo.mockResolvedValue(null);
    });

    it('technical miss → no_member_analysis, 스냅샷·이력 본문은 돌려주지 않고 publicAnalysisAt만 싣는다', async () => {
        findBySymbol.mockResolvedValue([snapshotRow]);
        findRecentForPrompt.mockResolvedValue([
            { generatedAt: new Date('2026-08-01'), trend: 'bullish' },
        ]);
        const r = await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'technical' },
            ctx,
            rt
        );
        expect(r).toEqual({
            found: false,
            tab: 'technical',
            symbol: 'LAES',
            reason: 'no_member_analysis',
            hint: 'call run_fresh_analysis',
            publicAnalysisAt: '2026-10-19T00:00:00.000Z',
        });
        expect(findRecentForPrompt).not.toHaveBeenCalled();
    });

    it('overall miss → no_member_analysis (스냅샷이 없으면 publicAnalysisAt 생략)', async () => {
        const r = await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'overall' },
            ctx,
            rt
        );
        expect(r).toEqual({
            found: false,
            tab: 'overall',
            symbol: 'LAES',
            reason: 'no_member_analysis',
            hint: 'call run_fresh_analysis',
        });
    });

    it('스냅샷 조회가 실패해도 miss 응답은 유지된다', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        findBySymbol.mockRejectedValue(new Error('db down'));
        const r = await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'technical' },
            ctx,
            rt
        );
        expect(r).toMatchObject({
            found: false,
            reason: 'no_member_analysis',
        });
    });

    it('technical: reasoning on 분석만 있어도 찾고 reasoning:true를 싣는다', async () => {
        peekAnalysis.mockImplementation(async (...a: unknown[]) =>
            a[4] === true ? analysisAt('2026-10-20T00:00:00Z', 'on') : null
        );
        const r = (await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'technical' },
            ctx,
            rt
        )) as {
            found: boolean;
            reasoning: boolean;
            analysis: { summary: string };
        };
        expect(r.found).toBe(true);
        expect(r.reasoning).toBe(true);
        expect(r.analysis.summary).toBe('on');
        expect(peekCallWithReasoning(false)).toBeDefined();
        expect(peekCallWithReasoning(true)).toBeDefined();
    });

    it('technical: 둘 다 있으면 analyzedAt이 늦은 쪽을 고른다', async () => {
        peekAnalysis.mockImplementation(async (...a: unknown[]) =>
            a[4] === true
                ? analysisAt('2026-10-20T00:00:00Z', 'on-older')
                : analysisAt('2026-10-21T00:00:00Z', 'off-newer')
        );
        const r = (await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'technical' },
            ctx,
            rt
        )) as { reasoning: boolean; analysis: { summary: string } };
        expect(r.analysis.summary).toBe('off-newer');
        expect(r.reasoning).toBe(false);

        peekAnalysis.mockImplementation(async (...a: unknown[]) =>
            a[4] === true
                ? analysisAt('2026-10-22T00:00:00Z', 'on-newer')
                : analysisAt('2026-10-21T00:00:00Z', 'off-older')
        );
        const r2 = (await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'technical' },
            ctx,
            rt
        )) as { reasoning: boolean; analysis: { summary: string } };
        expect(r2.analysis.summary).toBe('on-newer');
        expect(r2.reasoning).toBe(true);
    });

    it('overall: reasoning on 분석만 있어도 찾고, 둘 다 있으면 늦은 쪽을 고른다', async () => {
        const overall = (analyzedAt: string, headlineKo: string) => ({
            headlineKo,
            technicalBulletsKo: [],
            fundamentalBulletsKo: [],
            newsBulletsKo: [],
            optionsBulletsKo: [],
            integratedConclusionKo: 'c',
            scenarios: [],
            riskFactorsKo: [],
            financialsBulletsKo: [],
            analyzedAt,
        });
        peekOverall.mockImplementation(async (...a: unknown[]) =>
            a[4] === true ? overall('2026-10-20T00:00:00Z', 'on') : null
        );
        const only = (await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'overall' },
            ctx,
            rt
        )) as {
            found: boolean;
            reasoning: boolean;
            analysis: { headline: string };
        };
        expect(only).toMatchObject({ found: true, reasoning: true });
        expect(only.analysis.headline).toBe('on');

        peekOverall.mockImplementation(async (...a: unknown[]) =>
            a[4] === true
                ? overall('2026-10-20T00:00:00Z', 'on-older')
                : overall('2026-10-21T00:00:00Z', 'off-newer')
        );
        const both = (await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'overall' },
            ctx,
            rt
        )) as { reasoning: boolean; analysis: { headline: string } };
        expect(both.analysis.headline).toBe('off-newer');
        expect(both.reasoning).toBe(false);
    });

    it.each([
        ['free', freeCtx],
        ['guest', guestCtx],
    ])(
        '%s 호출자: miss면 기존대로 스냅샷을 돌려주고 reasoning은 한 번만(off) peek한다',
        async (_n, c) => {
            findBySymbol.mockResolvedValue([snapshotRow]);
            const r = (await getCachedAnalysisTool(
                { symbol: 'LAES', tab: 'technical' },
                c,
                rt
            )) as { found: boolean; source: string };
            expect(r).toMatchObject({ found: true, source: 'snapshot' });
            expect(peekCallWithReasoning(true)).toBeUndefined();
            expect(peekCallWithReasoning(false)).toBeDefined();
        }
    );

    it('회원이어도 technical/overall 외 탭은 스냅샷 폴백 그대로', async () => {
        findBySymbol.mockResolvedValue([{ ...snapshotRow, tab: 'news' }]);
        const r = await getCachedAnalysisTool(
            { symbol: 'LAES', tab: 'news' },
            ctx,
            rt
        );
        expect(r).toMatchObject({ found: true, source: 'snapshot' });
    });
});

describe('getCachedAnalysisTool — overall이 새 생성으로 이어질 때 신선한 technical로 대체', () => {
    const HOUR_MS = 60 * 60 * 1000;
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    // 봉이 빈 배열이면 `isStaleByBars`가 나이 규칙(technical/overall 1일)으로 떨어진다 — 1시간 전 = 신선, 3일 전 = 낡음.
    const technicalAt = (analyzedAt: string) => ({
        result: {
            summary: 'tech',
            trend: 'bullish',
            riskLevel: 'low',
            keyLevels: {},
            priceTargets: {},
            analyzedAt,
        },
        lockedInfoDepth: [],
    });
    const overallAt = (analyzedAt?: string) => ({
        headlineKo: 'h',
        technicalBulletsKo: [],
        fundamentalBulletsKo: [],
        newsBulletsKo: [],
        optionsBulletsKo: [],
        integratedConclusionKo: 'c',
        scenarios: [],
        riskFactorsKo: [],
        ...(analyzedAt ? { analyzedAt } : {}),
    });
    const overallSnapshot = (generatedAt: string) => ({
        tab: 'overall',
        generatedAt: new Date(generatedAt),
        model: 'm',
        plain: 'p',
        locale: 'ko',
        content: { x: 1 },
    });
    const expectSubstituted = (
        r: unknown,
        overallStatus: 'missing' | 'stale' = 'missing'
    ) =>
        expect(r).toMatchObject({
            found: true,
            source: 'redis',
            tab: 'technical',
            requestedTab: 'overall',
            overallStatus,
            stale: false,
            hint: expect.stringContaining('run_fresh_analysis'),
            analysis: { summary: 'tech' },
        });

    beforeEach(() => {
        vi.clearAllMocks();
        findByUserAndSymbol.mockResolvedValue(null);
        findBySymbol.mockResolvedValue([]);
        findRecentForPrompt.mockResolvedValue([]);
        peekAnalysis.mockResolvedValue(null);
        peekOverall.mockResolvedValue(null);
        profile.mockResolvedValue('us-equity');
        mockSessionSpecFor.mockReturnValue(US_EQUITY_SESSION);
        getQuote.mockResolvedValue(undefined);
        getCachedBars.mockResolvedValue({ bars: [], indicators: { ma: {} } });
        assetInfo.mockResolvedValue(null);
    });

    it('회원: overall miss + 같은 타임프레임 technical이 신선하면 technical로 답한다', async () => {
        peekAnalysis.mockResolvedValue(technicalAt(ago(HOUR_MS)));
        const r = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            ctx,
            rt
        );
        expectSubstituted(r);
        expect(r).not.toHaveProperty('reason');
        expect(r).not.toHaveProperty('overallGeneratedAt');
        expect(r).toMatchObject({
            hint: expect.stringContaining(
                'No SIGLENS overall analysis is available for this user'
            ),
        });
    });

    it('회원: technical이 낡았으면 no_member_analysis 그대로', async () => {
        peekAnalysis.mockResolvedValue(technicalAt(ago(3 * 24 * HOUR_MS)));
        const r = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            ctx,
            rt
        );
        expect(r).toMatchObject({
            found: false,
            tab: 'overall',
            reason: 'no_member_analysis',
        });
    });

    it('비회원: 전부 miss + technical 신선 → 대체', async () => {
        peekAnalysis.mockResolvedValue(technicalAt(ago(HOUR_MS)));
        const r = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            freeCtx,
            rt
        );
        expectSubstituted(r);
    });

    it('비회원: 공개 스냅샷 overall이 낡았으면 대체, 신선하면 스냅샷을 유지하고 technical은 조회하지 않는다', async () => {
        peekAnalysis.mockResolvedValue(technicalAt(ago(HOUR_MS)));
        const staleAt = ago(3 * 24 * HOUR_MS);
        findBySymbol.mockResolvedValue([overallSnapshot(staleAt)]);
        const substituted = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            freeCtx,
            rt
        );
        expectSubstituted(substituted, 'stale');
        expect(substituted).toMatchObject({
            overallGeneratedAt: staleAt,
            hint: expect.stringContaining('out of date'),
        });

        peekAnalysis.mockClear();
        findBySymbol.mockResolvedValue([overallSnapshot(ago(HOUR_MS))]);
        const kept = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            freeCtx,
            rt
        );
        expect(kept).toMatchObject({
            found: true,
            source: 'snapshot',
            tab: 'overall',
            stale: false,
        });
        expect(peekAnalysis).not.toHaveBeenCalled();
    });

    it('비회원: 스냅샷 없이 이력 digest overall이 낡았으면 대체', async () => {
        peekAnalysis.mockResolvedValue(technicalAt(ago(HOUR_MS)));
        const staleAt = ago(3 * 24 * HOUR_MS);
        findRecentForPrompt.mockResolvedValue([
            { generatedAt: new Date(staleAt), trend: 'bullish' },
        ]);
        const r = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            freeCtx,
            rt
        );
        expectSubstituted(r, 'stale');
        expect(r).toMatchObject({ overallGeneratedAt: staleAt });
    });

    it('redis overall이 낡았으면(stale:true) 대체, 신선도 불명(stale:null)이면 overall 유지', async () => {
        peekAnalysis.mockResolvedValue(technicalAt(ago(HOUR_MS)));
        const staleAt = ago(3 * 24 * HOUR_MS);
        peekOverall.mockResolvedValue(overallAt(staleAt));
        const r = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            ctx,
            rt
        );
        expectSubstituted(r, 'stale');
        expect(r).toMatchObject({ overallGeneratedAt: staleAt });

        peekOverall.mockResolvedValue(overallAt());
        const kept = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            ctx,
            rt
        );
        expect(kept).toMatchObject({
            found: true,
            source: 'redis',
            tab: 'overall',
            stale: null,
        });
        expect(kept).not.toHaveProperty('overallStatus');
    });

    it('요청한 타임프레임 그대로 technical을 찾는다 — 1Hour 질문에 다른 타임프레임 분석을 섞지 않는다', async () => {
        await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall', timeframe: '1Hour' },
            ctx,
            rt
        );
        expect(peekAnalysis).toHaveBeenCalled();
        expect(peekAnalysis.mock.calls.every(c => c[1] === '1Hour')).toBe(true);
    });

    it('substituteFreshTechnicalForOverall: false(공개 API)면 대체하지 않고 technical도 조회하지 않는다', async () => {
        peekAnalysis.mockResolvedValue(technicalAt(ago(HOUR_MS)));
        const r = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            ctx,
            { ...rt, substituteFreshTechnicalForOverall: false }
        );
        expect(r).toMatchObject({
            found: false,
            reason: 'no_member_analysis',
        });
        expect(peekAnalysis).not.toHaveBeenCalled();
    });

    it('technical 조회가 실패하면 원래 결과를 돌려준다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        peekAnalysis.mockRejectedValue(new Error('redis down'));
        const r = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'overall' },
            ctx,
            rt
        );
        expect(r).toMatchObject({
            found: false,
            reason: 'no_member_analysis',
        });
        warn.mockRestore();
    });

    it('overall 외 탭은 대체 대상이 아니다', async () => {
        peekAnalysis.mockResolvedValue(technicalAt(ago(HOUR_MS)));
        const r = await getCachedAnalysisTool(
            { symbol: 'NVDA', tab: 'news' },
            ctx,
            rt
        );
        expect(r).toEqual({
            found: false,
            tab: 'news',
            symbol: 'NVDA',
            hint: 'call run_fresh_analysis',
        });
    });
});

describe('getCachedAnalysisTool — 차트 블록', () => {
    const HOUR_MS = 60 * 60 * 1000;
    const DAY_S = 86_400;
    const bars = Array.from({ length: 5 }, (_, i) => ({
        time: i * DAY_S,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
    }));
    const overlay = {
        id: 't1',
        kind: 'trendline',
        skill: 'trend',
        sourceRef: 't1',
        variant: 'primary',
        segments: [
            {
                from: { time: DAY_S, price: 1 },
                to: { time: 3 * DAY_S, price: 2 },
                role: 'support',
                style: 'solid',
                pane: 'price',
            },
        ],
        levels: [],
        labels: [],
    };
    const technical = (analyzedAt: string) => ({
        result: {
            summary: 'tech',
            trend: 'bullish',
            riskLevel: 'low',
            keyLevels: {},
            priceTargets: {},
            analyzedAt,
            chartOverlays: [overlay],
        },
        lockedInfoDepth: [],
    });
    /** `emitChart`가 받은 블록 promise를 `emitted.block`에 남긴다(호출 순번으로 꺼내지 않는다). */
    const emitting = () => {
        const emitted: { block?: Promise<unknown> } = {};
        const emitChart = vi.fn((pending: Promise<unknown>) => {
            emitted.block = pending;
        });
        return { runtime: { ...rt, emitChart }, emitChart, emitted };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        findByUserAndSymbol.mockResolvedValue(null);
        findBySymbol.mockResolvedValue([]);
        findRecentForPrompt.mockResolvedValue([]);
        peekAnalysis.mockResolvedValue(null);
        peekOverall.mockResolvedValue(null);
        profile.mockResolvedValue('us-equity');
        mockSessionSpecFor.mockReturnValue(US_EQUITY_SESSION);
        getQuote.mockResolvedValue(undefined);
        getCachedBars.mockResolvedValue({ bars, indicators: { ma: {} } });
        assetInfo.mockResolvedValue(null);
    });

    it('technical redis 적중이면 그 분석의 작도로 차트 블록을 낸다', async () => {
        peekAnalysis.mockResolvedValue(
            technical(new Date(Date.now() - HOUR_MS).toISOString())
        );
        const { runtime, emitChart, emitted } = emitting();
        await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'technical' },
            ctx,
            runtime
        );
        expect(emitChart).toHaveBeenCalledTimes(1);
        await expect(emitted.block).resolves.toMatchObject({
            symbol: 'QQQ',
            timeframe: '1Day',
            overlays: [expect.objectContaining({ id: 't1' })],
        });
    });

    it('게스트(무료 등급)도 차트에는 작도를 싣는다 — 작도 제한 없는 설정으로 같은 캐시를 다시 꺼낸다', async () => {
        const at = new Date(Date.now() - HOUR_MS).toISOString();
        const full = technical(at);
        // 호출자 티어 설정(작도 제한 있음)으로는 작도가 빠지고, 제한을 끈 설정으로는 남는다.
        peekAnalysis.mockImplementation(async (...args: unknown[]) => {
            const config = args[6] as {
                featureFlags: { enableInfoDepthRestrictions: boolean };
            };
            return config.featureFlags.enableInfoDepthRestrictions
                ? {
                      ...full,
                      result: { ...full.result, chartOverlays: [] },
                  }
                : full;
        });
        const { runtime, emitted } = emitting();
        const r = (await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'technical' },
            guestCtx,
            runtime
        )) as { found: boolean };
        expect(r.found).toBe(true);
        await expect(emitted.block).resolves.toMatchObject({
            overlays: [expect.objectContaining({ id: 't1' })],
        });
        // 모델이 받는 분석은 호출자 티어 설정(TIER_CONFIG)으로 꺼낸 것이다.
        expect(peekAnalysis).toHaveBeenCalledWith(
            'QQQ',
            '1Day',
            undefined,
            rt.analysisModel,
            false,
            guestCtx.tier,
            TIER_CONFIG,
            undefined,
            guestCtx.locale,
            { benchmarkSymbol: 'SPY' }
        );
    });

    it('작도용 재조회가 비면 모델이 받은 분석으로 그린다', async () => {
        const at = new Date(Date.now() - HOUR_MS).toISOString();
        const filtered = {
            ...technical(at),
            result: { ...technical(at).result, chartOverlays: [] },
        };
        peekAnalysis.mockImplementation(async (...args: unknown[]) =>
            args[6] === TIER_CONFIG ? filtered : null
        );
        const { runtime, emitted } = emitting();
        await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'technical' },
            guestCtx,
            runtime
        );
        await expect(emitted.block).resolves.toMatchObject({
            overlays: [],
            analyzedAt: at,
        });
    });

    it('작도용 재조회가 다른 분석(생성 시각이 다름)이면 쓰지 않고 모델이 받은 분석으로 그린다', async () => {
        const at = new Date(Date.now() - HOUR_MS).toISOString();
        const newer = new Date(Date.now() - 60_000).toISOString();
        const filtered = {
            ...technical(at),
            result: { ...technical(at).result, chartOverlays: [] },
        };
        peekAnalysis.mockImplementation(async (...args: unknown[]) =>
            args[6] === TIER_CONFIG ? filtered : technical(newer)
        );
        const { runtime, emitted } = emitting();
        await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'technical' },
            guestCtx,
            runtime
        );
        await expect(emitted.block).resolves.toMatchObject({
            overlays: [],
            analyzedAt: at,
        });
    });

    it('회원 작도 재조회는 원래 peek과 같은 키(채택된 reasoning·보유 버킷·로케일)로 읽는다', async () => {
        findByUserAndSymbol.mockResolvedValue({ averagePrice: '100' });
        getQuote.mockResolvedValue({ price: 150 });
        const at = new Date(Date.now() - HOUR_MS).toISOString();
        // reasoning on 항목만 있다 — 회원 peek은 그 항목을 고른다.
        peekAnalysis.mockImplementation(async (...args: unknown[]) =>
            args[4] === true ? technical(at) : null
        );
        const { runtime, emitted } = emitting();
        await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'technical' },
            ctx,
            runtime
        );
        await emitted.block;
        // 모델용 peek(TIER_CONFIG)이 받은 보유 버킷을 작도용 재조회도 그대로 받는다.
        const modelPeek = peekAnalysis.mock.calls.find(
            c => c[6] === TIER_CONFIG && c[4] === true
        );
        // 평단 100·현재가 150(+50%)은 core 기준 'deep-profit'이다.
        const bucket = modelPeek?.[7];
        expect(bucket).toBe('deep-profit');
        expect(peekAnalysis).toHaveBeenCalledWith(
            'QQQ',
            '1Day',
            undefined,
            rt.analysisModel,
            true,
            ctx.tier,
            expect.objectContaining({
                featureFlags: expect.objectContaining({
                    enableInfoDepthRestrictions: false,
                }),
            }),
            bucket,
            ctx.locale,
            { benchmarkSymbol: 'SPY' }
        );
    });

    it('분석이 없으면 차트 블록을 내지 않는다', async () => {
        const { runtime, emitChart } = emitting();
        await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'technical' },
            freeCtx,
            runtime
        );
        expect(emitChart).not.toHaveBeenCalled();
    });

    it('overall 대체가 채택되면 technical 차트를 내고, 버려지면(낡음) 내지 않는다', async () => {
        peekAnalysis.mockResolvedValue(
            technical(new Date(Date.now() - HOUR_MS).toISOString())
        );
        const accepted = emitting();
        await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'overall' },
            ctx,
            accepted.runtime
        );
        expect(accepted.emitChart).toHaveBeenCalledTimes(1);

        // 봉이 없으면 신선도가 나이 규칙(1일)으로 떨어져 3일 전 분석은 낡았다 — 대체가 버려진다.
        getCachedBars.mockResolvedValue({ bars: [], indicators: { ma: {} } });
        peekAnalysis.mockResolvedValue(
            technical(new Date(Date.now() - 3 * 24 * HOUR_MS).toISOString())
        );
        const rejected = emitting();
        await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'overall' },
            ctx,
            rejected.runtime
        );
        expect(rejected.emitChart).not.toHaveBeenCalled();
    });

    it('봉 조회가 실패해도 차트 블록 promise는 null로 끝난다(던지지 않는다)', async () => {
        peekAnalysis.mockResolvedValue(
            technical(new Date(Date.now() - HOUR_MS).toISOString())
        );
        getCachedBars.mockRejectedValue(new Error('fmp down'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { runtime, emitted } = emitting();
        await getCachedAnalysisTool(
            { symbol: 'QQQ', tab: 'technical' },
            ctx,
            runtime
        );
        await expect(emitted.block).resolves.toBeNull();
    });
});

describe('withLevelLadder (evaluation replay enricher)', () => {
    const analysis = {
        keyLevels: {
            support: [{ price: 125, reason: 'r' }],
            resistance: [{ price: 115, reason: 'r' }],
        },
        priceTargets: null,
        actionRecommendation: null,
    };
    const recorded = {
        found: true,
        analysis,
        sinceAnalysis: {
            priceNow: 120,
            movePct: 1,
            nearestSupport: { price: 100, distancePct: -16.67 },
            nearestResistance: { price: 130, distancePct: 8.33 },
        },
    };

    it('swaps the old nearest pair for a ladder built from the recorded analysis and priceNow', () => {
        const out = withLevelLadder(recorded, null);
        expect(out.sinceAnalysis).not.toHaveProperty('nearestSupport');
        expect(out.sinceAnalysis).not.toHaveProperty('nearestResistance');
        expect(out.sinceAnalysis).toMatchObject({
            priceNow: 120,
            movePct: 1,
            levelLadder: {
                above: [{ price: 125 }],
                below: [{ price: 115 }],
            },
        });
        // the input is not mutated
        expect(recorded.sinceAnalysis).toHaveProperty('nearestSupport');
    });

    it('adds chart references when given', () => {
        const out = withLevelLadder(recorded, {
            high52w: 140,
            low52w: null,
            high20: null,
            low20: null,
            sma20: null,
            sma50: null,
            sma200: null,
        });
        expect(
            (
                out.sinceAnalysis as unknown as {
                    levelLadder: { above: Array<{ price: number }> };
                }
            ).levelLadder.above.map(l => l.price)
        ).toEqual([125, 140]);
    });

    it('drops the pair and adds no ladder when no level survives', () => {
        const out = withLevelLadder(
            { ...recorded, analysis: { keyLevels: null } },
            null
        );
        expect(out.sinceAnalysis).toEqual({ priceNow: 120, movePct: 1 });
    });

    it('returns a result without sinceAnalysis or analysis unchanged', () => {
        const noSince = { found: true, analysis };
        expect(withLevelLadder(noSince, null)).toBe(noSince);
        const noAnalysis = { found: false, sinceAnalysis: { priceNow: 1 } };
        expect(withLevelLadder(noAnalysis, null)).toBe(noAnalysis);
    });
});

describe('getCachedAnalysisTool — sinceEarlier', () => {
    const bars = rallyBars();
    const earlierAt = analyzedAfterClose(bars, 112);
    const laterAt = '2026-11-14T10:00:00.000Z';
    const earlier = {
        symbol: 'AAPL',
        generatedAt: earlierAt,
        analysis: earlierProjection(),
        seq: 5,
    };
    const technical = (analyzedAt: string) => ({
        result: {
            summary: '요약',
            trend: 'bullish',
            riskLevel: 'low',
            keyLevels: {},
            priceTargets: {},
            analyzedAt,
        },
        lockedInfoDepth: [],
    });
    const withEarlier = { ...rt, earlierAnalyses: [earlier] };
    afterEach(() => {
        vi.useRealTimers();
    });
    type Result = { sinceEarlier?: Record<string, unknown> };

    beforeEach(() => {
        vi.clearAllMocks();
        // 시계를 고정한다 — 마지막 봉이 형성 중인지, 분석이 낡았는지가 실행 시각에 따라 달라지지 않게.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-14T11:00:00.000Z'));
        findByUserAndSymbol.mockResolvedValue(null);
        findBySymbol.mockResolvedValue([]);
        findRecentForPrompt.mockResolvedValue([]);
        peekAnalysis.mockResolvedValue(technical(laterAt));
        peekOverall.mockResolvedValue(null);
        profile.mockResolvedValue('us-equity');
        mockSessionSpecFor.mockReturnValue(US_EQUITY_SESSION);
        getQuote.mockResolvedValue(undefined);
        getCachedBars.mockResolvedValue({ bars, indicators: { ma: {} } });
        assetInfo.mockResolvedValue(null);
    });

    it('이 대화의 이전 분석이 있으면 technical 일봉 결과에 계산된 차이를 싣는다', async () => {
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            withEarlier
        )) as Result;
        expect(r.sinceEarlier).toMatchObject({
            earlierGeneratedAt: earlierAt,
            fromSessionDate: tradingDateOf(bars, 112),
            toSessionDate: tradingDateOf(bars, bars.length - 1),
            comparedLevels: true,
        });
        expect(r.sinceEarlier?.changes).toEqual([
            {
                kind: 'level_crossed',
                side: 'resistance',
                price: 96,
                direction: 'up',
                close: 96.6,
                date: '2026-10-26',
            },
            {
                kind: 'level_crossed',
                side: 'resistance',
                price: 105,
                direction: 'up',
                close: 105.4,
                date: '2026-11-05',
            },
            { kind: 'trend_changed', from: 'neutral', to: 'bullish' },
        ]);
    });

    it('이전 분석이 없거나 다른 종목이면 결과가 이 기능이 없던 때와 바이트 단위로 같다', async () => {
        const args = { symbol: 'AAPL', tab: 'technical' };
        const baseline = JSON.stringify(
            await getCachedAnalysisTool(args, ctx, rt)
        );
        expect(baseline).not.toContain('sinceEarlier');
        for (const earlierAnalyses of [[], [{ ...earlier, symbol: 'MSFT' }]]) {
            expect(
                JSON.stringify(
                    await getCachedAnalysisTool(args, ctx, {
                        ...rt,
                        earlierAnalyses,
                    })
                )
            ).toBe(baseline);
        }
    });

    it('이전 분석과 같은 세션이면 싣지 않는다', async () => {
        const last = bars.length - 1;
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            {
                ...rt,
                earlierAnalyses: [
                    { ...earlier, generatedAt: analyzedAfterClose(bars, last) },
                ],
            }
        )) as Result;
        expect(r.sinceEarlier).toBeUndefined();
    });

    it('분석 생성 시각을 모르면(analyzedAt 없음) 지금 시각으로 때우지 않고 비교하지 않는다', async () => {
        peekAnalysis.mockResolvedValue({
            result: { ...technical(laterAt).result, analyzedAt: undefined },
            lockedInfoDepth: [],
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            withEarlier
        )) as Result;
        expect(r).toMatchObject({ found: true });
        expect(r.sinceEarlier).toBeUndefined();
    });

    it('overall 탭 결과에는 싣지 않는다', async () => {
        peekOverall.mockResolvedValue({
            headlineKo: 'h',
            technicalBulletsKo: [],
            fundamentalBulletsKo: [],
            newsBulletsKo: [],
            optionsBulletsKo: [],
            integratedConclusionKo: 'c',
            scenarios: [],
            riskFactorsKo: [],
            analyzedAt: laterAt,
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'overall' },
            ctx,
            withEarlier
        )) as Result;
        expect(r).toMatchObject({ found: true, tab: 'overall' });
        expect(r.sinceEarlier).toBeUndefined();
    });

    it('intraday 타임프레임 결과에는 싣지 않는다', async () => {
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical', timeframe: '1Hour' },
            ctx,
            withEarlier
        )) as Result;
        expect(r).toMatchObject({ found: true, timeframe: '1Hour' });
        expect(r.sinceEarlier).toBeUndefined();
    });

    it('최악의 경우: 분석 투영만으로 상한을 넘어도 블록은 통째로 남고 본문만 줄어든다(fit 전에 합친다)', async () => {
        const projection = earlierProjection();
        projection.keyLevels = {
            support: [{ price: 88, reason: '' }],
            // 분석일 종가(93.3)보다 위 14개 — 지금 종가(112)가 모두 넘었다.
            resistance: Array.from({ length: 14 }, (_, i) => ({
                price: 94 + i,
                reason: '',
            })),
        };
        const longText = (label: string) =>
            `${label} 해설이 이어집니다. `.repeat(80);
        const raw = {
            summary: '요약 문장입니다. '.repeat(1000),
            trend: 'bullish',
            riskLevel: 'low',
            keyLevels: { support: [100, 95, 90], resistance: [110, 115] },
            priceTargets: { bullish: 130, bearish: 85 },
            analyzedAt: laterAt,
            patternSummaries: Array.from({ length: 5 }, (_, i) => ({
                id: `p${i}`,
                patternName: `pattern-${i}`,
                skillName: 'chart-pattern',
                detected: true,
                trend: 'bullish',
                summary: longText(`패턴${i}`),
                confidenceWeight: 0.9 - i * 0.1,
            })),
            strategyResults: Array.from({ length: 5 }, (_, i) => ({
                id: `s${i}`,
                strategyName: `strategy-${i}`,
                trend: 'bullish',
                summary: longText(`전략${i}`),
                confidenceWeight: 0.8 - i * 0.1,
            })),
            candlePatterns: Array.from({ length: 5 }, (_, i) => ({
                id: `c${i}`,
                patternName: `candle-${i}`,
                detected: true,
                trend: 'bullish',
                summary: longText(`캔들${i}`),
            })),
        };
        // 전제: 블록 없이 분석 투영만으로 이미 상한을 넘는다.
        expect(
            JSON.stringify(projectTechnicalAnalysis(raw as never)).length
        ).toBeGreaterThan(CACHED_ANALYSIS_MAX_CHARS);
        peekAnalysis.mockResolvedValue({ result: raw, lockedInfoDepth: [] });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            { ...rt, earlierAnalyses: [{ ...earlier, analysis: projection }] }
        )) as {
            sinceEarlier: {
                changes: { kind: string }[];
                omittedLevelCrossings?: number;
                note: string;
            };
            analysis: {
                summary: string;
                keyLevels: unknown;
                patterns: unknown[];
            };
        };
        expect(r).not.toHaveProperty('truncated');
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            CACHED_ANALYSIS_MAX_CHARS
        );
        // 블록이 통째로: 가격대 돌파 6 + 추세 1, 나머지 8개는 개수로, 규칙 문장도 그대로.
        expect(r.sinceEarlier.changes.map(c => c.kind)).toEqual([
            'level_crossed',
            'level_crossed',
            'level_crossed',
            'level_crossed',
            'level_crossed',
            'level_crossed',
            'trend_changed',
        ]);
        expect(r.sinceEarlier.omittedLevelCrossings).toBe(8);
        expect(r.sinceEarlier.note).toBe(SINCE_EARLIER_NOTE);
        // 본문은 줄고 구조(keyLevels)는 그대로다.
        expect(r.analysis.summary.length).toBeLessThan(raw.summary.length);
        expect(r.analysis.keyLevels).toEqual(raw.keyLevels);
        expect(r.analysis.patterns.length).toBeGreaterThan(0);
    });
});
