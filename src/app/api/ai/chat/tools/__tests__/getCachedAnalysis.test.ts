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
vi.mock('@/entities/bars/lib/barsDataCache', () => ({
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
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
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

import { buildPlanCheck, TIER_CONFIG } from '@y0ngha/siglens-core';
import { getCachedAnalysisTool } from '@/app/api/ai/chat/tools/getCachedAnalysis';
import { CACHED_ANALYSIS_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { QUOTE_LOOKUP_TIMEOUT_MS } from '@/shared/api/market/quoteTimeout';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';

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
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

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
        getCachedBars.mockResolvedValue({ bars: [], indicators: {} });
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
        expect(r.analysis.patterns).toEqual([
            {
                name: 'head_and_shoulders',
                trend: 'bearish',
                confidence: 0.9,
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
            expect.any(String)
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
            ctx,
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
            indicators: {},
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
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
            ctx.tier
        );
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
            ctx,
            rt
        )) as {
            found: boolean;
            source: string;
        };
        expect(r.found).toBe(true);
        expect(r.source).toBe('history');
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
            indicators: {},
        });
        const r = (await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
            rt
        )) as { source: string; stale: boolean };
        expect(r.source).toBe('history');
        expect(r.stale).toBe(false);
        expect(getCachedBars).toHaveBeenCalled();
    });

    it('전부 miss면 found:false + hint, quote/bars 조회는 전혀 일어나지 않는다', async () => {
        const r = await getCachedAnalysisTool(
            { symbol: 'AAPL', tab: 'technical' },
            ctx,
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
                indicators: {},
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
                indicators: {},
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
            getCachedBars.mockResolvedValue({ bars: [], indicators: {} });
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
                indicators: {},
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
                indicators: {},
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
                indicators: {},
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
        it('quote가 있으면 analysisPrice/priceNow/movePct/levelsBroken/nearest*를 계산하고 planNow는 buildPlanCheck로 채워진다', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    summary: 'sum',
                    trend: 'bullish',
                    riskLevel: 'low',
                    keyLevels: {
                        support: [
                            { price: 100, reason: 'r' }, // below priceNow=120 → still support, nearestSupport candidate
                            { price: 125, reason: 'r' }, // ABOVE priceNow=120 → broken (fell through); must NOT be nearestSupport
                        ],
                        resistance: [
                            { price: 115, reason: 'r' }, // below priceNow=120 → broken (broke above); must NOT be nearestResistance
                            { price: 130, reason: 'r' }, // above priceNow=120 → nearestResistance candidate
                            { price: 140, reason: 'r' }, // further above → not nearest
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
                    nearestSupport: { price: number } | null;
                    nearestResistance: { price: number } | null;
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
            // A broken support (125, ABOVE price) must never surface as
            // "nearest support" — only 100 (still at/below price) qualifies.
            expect(r.sinceAnalysis.nearestSupport).toEqual({
                price: 100,
                distancePct: expect.any(Number),
            });
            // A broken resistance (115, BELOW price) must never surface as
            // "nearest resistance" — only 130 (at/above price) qualifies,
            // not 140 (further away).
            expect(r.sinceAnalysis.nearestResistance).toEqual({
                price: 130,
                distancePct: expect.any(Number),
            });
            // entryPrices=[95,105] → entry mid 100; entryZoneTop=105.
            // priceNow=120 > 105*1.01 → exceedsEntryZone; stopLoss=90 < priceNow → not belowStopLoss.
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

        it('nearestSupport/nearestResistance: 유효한 후보가 priceNow 쪽에 없으면 null', async () => {
            getQuote.mockResolvedValue({ price: 120 });
            peekAnalysis.mockResolvedValue({
                result: {
                    ...technicalCachedResult.result,
                    keyLevels: {
                        support: [{ price: 125, reason: 'r' }], // only above price → no valid support candidate
                        resistance: [{ price: 115, reason: 'r' }], // only below price → no valid resistance candidate
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
                    nearestSupport: unknown;
                    nearestResistance: unknown;
                };
            };
            expect(r.sinceAnalysis.nearestSupport).toBeNull();
            expect(r.sinceAnalysis.nearestResistance).toBeNull();
        });

        it('가격이 비유한값이거나 0 이하인 레벨은 nearest/levelsBroken 어디에도 나타나지 않는다', async () => {
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
                    nearestSupport: { price: number } | null;
                    nearestResistance: unknown;
                    levelsBroken: unknown[];
                };
            };
            expect(r.sinceAnalysis.nearestSupport).toEqual({
                price: 90,
                distancePct: expect.any(Number),
            });
            expect(r.sinceAnalysis.nearestResistance).toBeNull();
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

        it('nearestSupport/nearestResistance의 distancePct는 core 컨벤션(level−price)/price를 따른다 — 위쪽 레벨은 양수, 아래쪽은 음수', async () => {
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
                    nearestSupport: { price: number; distancePct: number };
                    nearestResistance: { price: number; distancePct: number };
                };
            };
            // (130-120)/120*100 = 8.33333...  →  roundNumber (6 significant
            // digits, not 2 decimals) = 8.33333, not the naive 8.33.
            expect(r.sinceAnalysis.nearestResistance).toEqual({
                price: 130,
                distancePct: 8.33333,
            });
            // (110-120)/120*100 = -8.33333...
            expect(r.sinceAnalysis.nearestSupport).toEqual({
                price: 110,
                distancePct: -8.33333,
            });
        });

        it('quote도 last close도 못 구하면 sinceAnalysis 자체가 없다', async () => {
            getQuote.mockResolvedValue(undefined);
            getCachedBars.mockResolvedValue({ bars: [], indicators: {} });
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
                indicators: {},
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
                indicators: {},
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
                indicators: {},
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
