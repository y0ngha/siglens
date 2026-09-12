import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
    runAnalysis: vi.fn(),
    overall: vi.fn(),
    news: vi.fn(),
    options: vi.fn(),
    profile: vi.fn(async () => 'us-equity'),
    assetInfo: vi.fn(async () => ({ name: 'Apple', fmpSymbol: 'AAPL' })),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    runAnalysis: m.runAnalysis,
}));
vi.mock('@/entities/analysis/actions', () => ({
    runOverallAnalysisAction: m.overall,
}));
vi.mock('@/entities/news-article/actions', () => ({
    submitNewsAnalysisAction: m.news,
}));
vi.mock('@/entities/options-chain/actions', () => ({
    submitOptionsAnalysisAction: m.options,
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: m.profile,
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: m.assetInfo,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: () => ({}),
}));
vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: () => ({
        assetClass: 'equity',
        priceFormat: { currency: 'USD' },
    }),
}));

import {
    __resetFreshSemaphoreForTests,
    runFreshAnalysisTool,
} from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { truncateToolResult } from '@/app/api/ai/chat/tools/truncate';
import {
    __activeStreamCount,
    __resetActiveStreamsForTests,
} from '@/shared/lib/sse/activeStreams';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

/**
 * Minimal-but-valid technical fixture for tests that don't care about the
 * payload shape (semaphore/busy plumbing) — kept tiny on purpose.
 */
const TECHNICAL_FIXTURE = {
    summary: 's',
    trend: 'bullish',
    riskLevel: 'medium',
    keyLevels: {},
    priceTargets: {},
};

/**
 * A realistic-size technical `AnalysisResponse`: 12 indicator results (this
 * repo ships 14 indicator skills — 6 is the documented conservative case,
 * 12 pushes well past it), 4 pattern summaries, plus a long Korean summary
 * — the shape a real analysis produces, not the `{summary:'s'}` toy fixture
 * that let the untrimmed-payload bug through review undetected.
 */
const REALISTIC_TECHNICAL_RESULT = {
    summary:
        '이 종목은 최근 거래일 기준으로 강한 상승 모멘텀을 보이고 있습니다. '.repeat(
            40
        ),
    trend: 'bullish',
    riskLevel: 'medium',
    keyLevels: {
        support: [100, 95, 90],
        resistance: [110, 115, 120],
    },
    priceTargets: { bullish: 130, bearish: 85 },
    actionRecommendation: {
        positionAnalysis: '현재가는 저항선 부근에 위치합니다.',
        entry: '110~112 구간 분할 매수',
        exit: '120 익절, 95 손절',
        riskReward: '1:2.3',
    },
    indicatorResults: Array.from({ length: 12 }, (_, i) => ({
        skill: `indicator-${i}`,
        signal: `signal-${i}`,
        interpretation:
            `지표 ${i}는 매수 신호를 나타내고 있으며 추가 상승 여력이 있습니다. `.repeat(
                3
            ),
    })),
    patternSummaries: Array.from({ length: 4 }, (_, i) => ({
        pattern: `pattern-${i}`,
        confidence: 0.8,
    })),
    strategyResults: Array.from({ length: 3 }, (_, i) => ({
        skill: `strategy-${i}`,
        verdict: 'buy',
    })),
    candlePatterns: Array.from({ length: 3 }, (_, i) => ({
        pattern: `candle-${i}`,
    })),
    trendlines: Array.from({ length: 2 }, (_, i) => ({ slope: i })),
};

/**
 * A realistic-size `OverallAnalysisResponse`: every axis carries several
 * multi-sentence Korean bullets plus a long integrated conclusion — unlike
 * the technical case, `get_cached_analysis`'s 8-field shape IS essentially
 * the whole response (there's no big array to drop), so this is the case
 * that actually needs `fitProse`'s trimming, not just the projection.
 */
const REALISTIC_OVERALL_RESULT = {
    headlineKo: 'AAPL은 강세 흐름을 지속하고 있습니다.',
    technicalBulletsKo: Array.from({ length: 6 }, (_, i) =>
        `기술적 분석 요점 ${i}: 이동평균선이 상승 배열을 유지합니다. `.repeat(3)
    ),
    fundamentalBulletsKo: Array.from({ length: 6 }, (_, i) =>
        `펀더멘털 요점 ${i}: 매출 성장률이 예상치를 상회합니다. `.repeat(3)
    ),
    newsBulletsKo: Array.from({ length: 6 }, (_, i) =>
        `뉴스 요점 ${i}: 최근 실적 발표가 긍정적으로 반영되었습니다. `.repeat(3)
    ),
    optionsBulletsKo: Array.from({ length: 6 }, (_, i) =>
        `옵션 요점 ${i}: 풋콜 비율이 낙관적인 심리를 시사합니다. `.repeat(3)
    ),
    financialsBulletsKo: [],
    integratedConclusionKo:
        '종합적으로 이 종목은 4개 축 모두에서 긍정적인 신호를 보이고 있으며, 단기 조정 이후 재상승이 예상됩니다. '.repeat(
            30
        ),
    scenarios: [
        { case: 'bullish', target: 130 },
        { case: 'bearish', target: 90 },
    ],
    riskFactorsKo: Array.from({ length: 5 }, (_, i) =>
        `리스크 요인 ${i}: 금리 인상 가능성이 부담 요인입니다. `.repeat(3)
    ),
};

/**
 * A realistic-size `OptionsAnalysisResponse`: 18 expirations (a weekly-heavy
 * ticker like PLTR/NVDA requesting `'all'` expirations, per the review
 * finding) each with ~250-char Korean commentary, plus 15 signals — more
 * than core's normalizer caps anywhere, which is exactly the gap this
 * fixture exists to catch.
 */
const REALISTIC_OPTIONS_RESULT = {
    summary:
        '전반적으로 콜 포지셔닝이 우세하며 단기 변동성이 확대되고 있습니다.',
    perExpiration: Array.from({ length: 18 }, (_, i) => ({
        expirationDate: `2026-0${(i % 9) + 1}-1${i % 9}`,
        commentary:
            `이 만기의 풋콜 비율은 낙관적인 포지셔닝을 시사하며, 최대 미결제약정 스트라이크는 현재가 부근에 형성되어 저항선 역할을 할 가능성이 있으며, 대형 기관 투자자들의 헤지 수요가 동시에 관찰되고 있습니다. 만기 ${i}. `.repeat(
                2
            ),
        tone: 'bullish' as const,
    })),
    signals: Array.from({ length: 15 }, (_, i) => ({
        kind: 'bullish' as const,
        message: `콜 매수세가 강하게 유입되고 있습니다 (${i}).`,
    })),
    analyzedAt: '2026-09-12T00:00:00.000Z',
};

describe('runFreshAnalysisTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        m.profile.mockResolvedValue('us-equity');
        m.assetInfo.mockResolvedValue({ name: 'Apple', fmpSymbol: 'AAPL' });
        __resetFreshSemaphoreForTests();
        __resetActiveStreamsForTests();
    });

    it('technical: core runAnalysis(모델·tier·locale, signal 없음), 슬롯 해제', async () => {
        m.runAnalysis.mockResolvedValue({
            status: 'done',
            result: { summary: 's', trend: 'bullish' },
        });
        const r = await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'technical' },
            ctx,
            rt
        );
        expect(r).toMatchObject({
            found: true,
            source: 'fresh',
            tab: 'technical',
            analysis: { summary: 's' },
        });
        const [symbol, companyName, timeframe, force, fmpSymbol, options] =
            m.runAnalysis.mock.calls[0]!;
        expect([symbol, companyName, timeframe, force, fmpSymbol]).toEqual([
            'AAPL',
            'Apple',
            '1Day',
            false,
            'AAPL',
        ]);
        expect(options).toMatchObject({
            modelId: 'deepseek-v4.1-flash',
            tierContext: { userId: 'u', tier: 'member' },
            locale: 'ko',
            reasoning: false,
        });
        expect(options.signal).toBeUndefined();
        expect(__activeStreamCount()).toBe(0);
    });

    it('overall/news/options 분기', async () => {
        m.overall.mockResolvedValue({
            status: 'cached',
            result: { headlineKo: 'h' },
        });
        m.news.mockResolvedValue({ status: 'done', result: { summary: 'n' } });
        // Real `SubmitOptionsAnalysisNoChainsError` shape (core's
        // `application/options/types.ts`): `code` sits at the TOP level,
        // not nested under `error` (which is a plain string here, not an
        // object) — a fictional `{error:{code:...}}` shape would pass a
        // test but never occur in production.
        m.options.mockResolvedValue({
            status: 'no_chains_error',
            code: 'no_options_chains',
            error: 'No options chains available for this expiration filter.',
        });
        expect(
            await runFreshAnalysisTool(
                { symbol: 'AAPL', kind: 'overall' },
                ctx,
                rt
            )
        ).toMatchObject({ found: true, analysis: { headline: 'h' } });
        expect(
            await runFreshAnalysisTool(
                { symbol: 'AAPL', kind: 'news' },
                ctx,
                rt
            )
        ).toMatchObject({ found: true });
        expect(
            await runFreshAnalysisTool(
                { symbol: 'AAPL', kind: 'options' },
                ctx,
                rt
            )
        ).toEqual({ error: 'analysis_failed', code: 'no_options_chains' });
    });

    it('usage_limit_exceeded는 top-level code로 표면화된다(error.code 아님)', async () => {
        // Real `SubmitOptionsAnalysisLimitError` shape: `code` is top-level
        // AND `error` is an object that also carries a (different) `code`
        // — regression guard for picking the wrong one.
        m.options.mockResolvedValue({
            status: 'limit_error',
            code: 'usage_limit_exceeded',
            error: {
                code: 'usage_limit_exceeded',
                message: 'daily limit',
                feature: 'analysisPerDay',
                tier: 'member',
            },
        });
        expect(
            await runFreshAnalysisTool(
                { symbol: 'AAPL', kind: 'options' },
                ctx,
                rt
            )
        ).toEqual({ error: 'analysis_failed', code: 'usage_limit_exceeded' });
    });

    it('top-level code가 없으면 error.code로 폴백한다(technical의 usage-limit 변형)', async () => {
        // Real `SubmitAnalysisErrorResult` shape: `{status:'error', error: AnalysisLimitError}`
        // has NO top-level `code` — only `error.code`. Distinguishes
        // `errorObjectCode` from the `outcome.code` fallback.
        m.runAnalysis.mockResolvedValue({
            status: 'error',
            error: {
                code: 'usage_limit_exceeded',
                message: 'daily limit',
                feature: 'analysisPerDay',
                tier: 'member',
            },
        });
        expect(
            await runFreshAnalysisTool(
                { symbol: 'AAPL', kind: 'technical' },
                ctx,
                rt
            )
        ).toEqual({ error: 'analysis_failed', code: 'usage_limit_exceeded' });
    });

    it('세마포어 2 초과 → busy, core는 호출되지 않는다', async () => {
        // Deferreds (not `new Promise(() => {})`) so the two in-flight calls
        // are resolved and awaited before the test ends — an unsettled
        // promise here would leak a semaphore/`activeStreams` slot into
        // whichever test runs next.
        const deferreds: {
            resolve: (v: unknown) => void;
        }[] = [];
        m.runAnalysis.mockImplementation(
            () =>
                new Promise(resolve => {
                    deferreds.push({ resolve });
                })
        );
        const p1 = runFreshAnalysisTool(
            { symbol: 'A', kind: 'technical' },
            ctx,
            rt
        );
        const p2 = runFreshAnalysisTool(
            { symbol: 'B', kind: 'technical' },
            ctx,
            rt
        );
        // Let both calls reach `runAnalysis` (past their `Promise.all`
        // profile/asset lookups) before asserting the third is rejected.
        await Promise.resolve();
        await Promise.resolve();
        expect(
            await runFreshAnalysisTool(
                { symbol: 'C', kind: 'technical' },
                ctx,
                rt
            )
        ).toEqual({ error: 'busy', retryAfterSeconds: 60 });
        for (const d of deferreds)
            d.resolve({ status: 'done', result: TECHNICAL_FIXTURE });
        await Promise.all([p1, p2]);
        expect(__activeStreamCount()).toBe(0);
    });

    it('심볼 형태가 아니면 슬롯을 잡지 않고 invalid_args', async () => {
        const result = await runFreshAnalysisTool(
            { symbol: '../etc', kind: 'technical' },
            ctx,
            rt
        );
        expect(result).toMatchObject({ error: 'invalid_args' });
        expect(m.runAnalysis).not.toHaveBeenCalled();
        expect(__activeStreamCount()).toBe(0);
    });

    it('알 수 없는 kind면 슬롯을 잡지 않고 invalid_args', async () => {
        const result = await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'nope' },
            ctx,
            rt
        );
        expect(result).toMatchObject({ error: 'invalid_args' });
        expect(m.profile).not.toHaveBeenCalled();
        expect(__activeStreamCount()).toBe(0);
    });

    it('core가 throw해도 슬롯은 해제된다', async () => {
        m.runAnalysis.mockRejectedValue(new Error('provider 5xx'));
        await expect(
            runFreshAnalysisTool({ symbol: 'AAPL', kind: 'technical' }, ctx, rt)
        ).rejects.toThrow('provider 5xx');
        expect(__activeStreamCount()).toBe(0);
    });

    it('technical: 현실적인 크기의 결과도 절단 없이 핵심 필드가 살아남는다', async () => {
        m.runAnalysis.mockResolvedValue({
            status: 'done',
            result: REALISTIC_TECHNICAL_RESULT,
        });
        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'technical' },
            ctx,
            rt
        )) as { analysis: Record<string, unknown> };

        expect(truncateToolResult(r)).not.toMatchObject({ truncated: true });
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(4_000);
        expect(r.analysis.trend).toBe('bullish');
        expect(r.analysis.riskLevel).toBe('medium');
        expect(r.analysis.keyLevels).toEqual(
            REALISTIC_TECHNICAL_RESULT.keyLevels
        );
        expect(r.analysis.priceTargets).toEqual(
            REALISTIC_TECHNICAL_RESULT.priceTargets
        );
        expect(r.analysis.actionRecommendation).toEqual(
            REALISTIC_TECHNICAL_RESULT.actionRecommendation
        );
        expect(typeof r.analysis.summary).toBe('string');
        expect((r.analysis.summary as string).length).toBeGreaterThan(0);
        // The bulk offender must never reach the tool result.
        expect(r.analysis).not.toHaveProperty('indicatorResults');
        expect(r.analysis).not.toHaveProperty('patternSummaries');
    });

    it('overall: 현실적인 크기의 결과도 절단 없이 핵심 필드가 살아남는다', async () => {
        m.overall.mockResolvedValue({
            status: 'done',
            result: REALISTIC_OVERALL_RESULT,
        });
        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'overall' },
            ctx,
            rt
        )) as { analysis: Record<string, unknown> };

        expect(truncateToolResult(r)).not.toMatchObject({ truncated: true });
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(4_000);
        expect(r.analysis.headline).toBe(REALISTIC_OVERALL_RESULT.headlineKo);
        expect(r.analysis.scenarios).toEqual(
            REALISTIC_OVERALL_RESULT.scenarios
        );
        expect(typeof r.analysis.conclusion).toBe('string');
        expect((r.analysis.conclusion as string).length).toBeGreaterThan(0);
        const keptTechnical = r.analysis.technical as string[];
        expect(keptTechnical.length).toBeGreaterThan(0);
        // Regression guard for the "drop trailing whole" rule: swapping it
        // for a mid-string `slice` would leave every kept bullet green on
        // the length/truncation assertions above but produce a bullet that
        // doesn't byte-match anything in the original array.
        expect(
            keptTechnical.every(b =>
                REALISTIC_OVERALL_RESULT.technicalBulletsKo.includes(b)
            )
        ).toBe(true);
    });

    it('options: 현실적인 크기의 결과(18개 만기)도 절단 없이 앞쪽 만기가 살아남는다', async () => {
        m.options.mockResolvedValue({
            status: 'done',
            result: REALISTIC_OPTIONS_RESULT,
        });
        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'options' },
            ctx,
            rt
        )) as {
            analysis: {
                summary: string;
                signals: unknown[];
                perExpiration: { expirationDate: string; commentary: string }[];
            };
        };

        expect(truncateToolResult(r)).not.toMatchObject({ truncated: true });
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(4_000);
        expect(r.analysis.signals.length).toBeLessThanOrEqual(10);
        expect(r.analysis.perExpiration.length).toBeGreaterThan(0);
        expect(r.analysis.perExpiration.length).toBeLessThan(
            REALISTIC_OPTIONS_RESULT.perExpiration.length
        );
        // Earliest expirations survive (kept in original order, trailing
        // ones dropped), and every kept entry is byte-identical to an
        // original — never a mid-`commentary` cut.
        expect(r.analysis.perExpiration[0]!.expirationDate).toBe(
            REALISTIC_OPTIONS_RESULT.perExpiration[0]!.expirationDate
        );
        expect(
            r.analysis.perExpiration.every(entry =>
                REALISTIC_OPTIONS_RESULT.perExpiration.some(
                    original =>
                        original.expirationDate === entry.expirationDate &&
                        original.commentary === entry.commentary
                )
            )
        ).toBe(true);
    });
});
