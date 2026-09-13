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
