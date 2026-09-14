import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    peekAnalysis,
    peekOverall,
    findByUserAndSymbol,
    findBySymbol,
    findRecentForPrompt,
    profile,
    getQuote,
} = vi.hoisted(() => ({
    peekAnalysis: vi.fn(),
    peekOverall: vi.fn(),
    findByUserAndSymbol: vi.fn(),
    findBySymbol: vi.fn(),
    findRecentForPrompt: vi.fn(),
    profile: vi.fn(),
    getQuote: vi.fn(),
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
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { TIER_CONFIG } from '@y0ngha/siglens-core';
import { getCachedAnalysisTool } from '@/app/api/ai/chat/tools/getCachedAnalysis';
import { CACHED_ANALYSIS_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

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

    it('positionBucket 계산 시 holding.fmpSymbol이 있으면 그 값으로 시세를 조회한다 (item 2)', async () => {
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

    it('시세 조회가 throw해도 캐시된 분석은 (개인화 없이) 그대로 반환된다 (item 2)', async () => {
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
    });

    it('시세 조회가 멈춰도 타임아웃 내에 버킷 없이 진행된다 (item 2, fake timers)', async () => {
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
        await vi.advanceTimersByTimeAsync(5_000);
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

    it('overall: peekOverallAnalysisCache hit → 신선도 불명은 null로 표현한다 (item 3), getAssetInfo 조회 없음 (item 10)', async () => {
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

    it('전부 miss면 found:false + hint', async () => {
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
    });
});
