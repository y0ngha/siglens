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
import {
    CACHED_ANALYSIS_MAX_CHARS,
    truncateToolResult,
} from '@/app/api/ai/chat/tools/truncate';
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
const ensureSymbolData = vi.fn(async (): Promise<void> => {});
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData,
};

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
        id: `pattern-${i}`,
        patternName: `pattern-${i}`,
        skillName: `skill-${i}`,
        detected: true,
        trend: 'bullish',
        summary: `패턴 ${i}는 상승 반전 신호를 시사합니다. `.repeat(3),
        confidenceWeight: 0.8 - i * 0.1,
    })),
    strategyResults: Array.from({ length: 3 }, (_, i) => ({
        id: `strategy-${i}`,
        strategyName: `strategy-${i}`,
        trend: 'bullish',
        summary: `전략 ${i}는 매수 우위를 나타냅니다. `.repeat(3),
        confidenceWeight: 0.7 - i * 0.1,
    })),
    candlePatterns: Array.from({ length: 3 }, (_, i) => ({
        id: `candle-${i}`,
        patternName: `candle-${i}`,
        detected: true,
        trend: 'bullish',
        summary: `캔들 패턴 ${i}가 감지되었습니다. `.repeat(3),
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
                // Raised 5 → 8 (2026-09-14, CACHED_ANALYSIS_MAX_CHARS
                // 12,000 → 16,000): the old repeat count no longer forces
                // an overflow at the larger ceiling, which let all 18
                // expirations through unfitted instead of exercising the
                // "drop trailing whole" path this fixture exists to catch.
                8
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
            providerFallback: true,
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

    it('인스턴스당 동시 실행 상한(10) 초과 → busy, core는 호출되지 않는다', async () => {
        // Deferreds (not `new Promise(() => {})`) so the in-flight calls are
        // resolved and awaited before the test ends — an unsettled promise
        // here would leak a semaphore/`activeStreams` slot into whichever
        // test runs next.
        const CAP = 10; // MAX_CONCURRENT_FRESH in runFreshAnalysis.ts
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const deferreds: {
            resolve: (v: unknown) => void;
        }[] = [];
        m.runAnalysis.mockImplementation(
            () =>
                new Promise(resolve => {
                    deferreds.push({ resolve });
                })
        );
        const inFlight = Array.from({ length: CAP }, (_, i) =>
            runFreshAnalysisTool(
                { symbol: `S${i}`, kind: 'technical' },
                ctx,
                rt
            )
        );
        // Let every call reach `runAnalysis` (past its `Promise.all`
        // profile/asset lookups) before asserting the next one is rejected.
        await vi.waitFor(() => expect(deferreds).toHaveLength(CAP));
        expect(
            await runFreshAnalysisTool(
                { symbol: 'OVER', kind: 'technical' },
                ctx,
                rt
            )
        ).toEqual({ error: 'busy', retryAfterSeconds: 60 });
        expect(warn).toHaveBeenCalledWith(
            '[agent] busy',
            expect.objectContaining({
                reason: 'fresh_analysis_slots',
                cap: CAP,
            })
        );
        expect(m.runAnalysis).toHaveBeenCalledTimes(CAP);
        for (const d of deferreds)
            d.resolve({ status: 'done', result: TECHNICAL_FIXTURE });
        await Promise.all(inFlight);
        expect(__activeStreamCount()).toBe(0);
        warn.mockRestore();
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

    it('getAssetInfo가 throw해도 심볼을 회사명으로, fmpSymbol 없이 진행된다 (Promise.all이 통째로 reject하지 않는다)', async () => {
        m.assetInfo.mockRejectedValue(new Error('db down'));
        m.runAnalysis.mockResolvedValue({
            status: 'done',
            result: TECHNICAL_FIXTURE,
        });
        const result = await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'technical' },
            ctx,
            rt
        );
        expect(result).toMatchObject({ found: true });
        const [symbol, companyName, , , fmpSymbol] =
            m.runAnalysis.mock.calls[0]!;
        expect(symbol).toBe('AAPL');
        expect(companyName).toBe('AAPL');
        expect(fmpSymbol).toBeUndefined();
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

        expect(
            truncateToolResult(r, CACHED_ANALYSIS_MAX_CHARS)
        ).not.toMatchObject({ truncated: true });
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            CACHED_ANALYSIS_MAX_CHARS
        );
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
        expect(r.analysis).not.toHaveProperty('trendlines');
        // Patterns/strategies/candle patterns survive the projection so the
        // model can answer "is there a head-and-shoulders?" without the
        // prose summary having to mention it.
        const patterns = r.analysis.patterns as { name: string }[];
        expect(patterns.length).toBe(
            REALISTIC_TECHNICAL_RESULT.patternSummaries.length
        );
        expect(patterns[0]!.name).toBe(
            REALISTIC_TECHNICAL_RESULT.patternSummaries[0]!.patternName
        );
        const strategies = r.analysis.strategies as { name: string }[];
        expect(strategies.length).toBe(
            REALISTIC_TECHNICAL_RESULT.strategyResults.length
        );
        const candlePatterns = r.analysis.candlePatterns as {
            name: string;
        }[];
        expect(candlePatterns.length).toBe(
            REALISTIC_TECHNICAL_RESULT.candlePatterns.length
        );
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

        expect(
            truncateToolResult(r, CACHED_ANALYSIS_MAX_CHARS)
        ).not.toMatchObject({ truncated: true });
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            CACHED_ANALYSIS_MAX_CHARS
        );
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

        expect(
            truncateToolResult(r, CACHED_ANALYSIS_MAX_CHARS)
        ).not.toMatchObject({ truncated: true });
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            CACHED_ANALYSIS_MAX_CHARS
        );
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

describe('run_fresh_analysis 수급 게이트', () => {
    beforeEach(() => {
        ensureSymbolData.mockClear();
    });

    /**
     * 기준은 "수급을 돌리면 **이번 호출의 답**이 달라지는가"다.
     *
     * news·overall 축만 DB의 뉴스를 읽는다. 그리고 `ensureSymbolNewsFresh`가
     * 신규 기사를 **동기로** 보강하므로, 방금 넣은 기사가 `isEnrichedRow`를
     * 통과해 실제로 이번 분석에 들어간다 — 그게 이 게이트의 근거다.
     * technical·options는 뉴스를 아예 안 읽으므로 부르지 않는다.
     */
    it.each([
        ['news', true],
        ['overall', true],
        ['technical', false],
        ['options', false],
    ] as const)('kind=%s → 수급 %s', async (kind, expected) => {
        await runFreshAnalysisTool({ symbol: 'AAPL', kind }, ctx, rt);

        if (expected) {
            // 인자까지 고정한다 — 대문자화는 턴 메모 키(`index.ts`)와
            // `news:${symbol}` 태그 양쪽에서 load-bearing이다.
            expect(ensureSymbolData).toHaveBeenCalledExactlyOnceWith('AAPL');
        } else {
            expect(ensureSymbolData).not.toHaveBeenCalled();
        }
    });

    /**
     * 값싼 거절이 FMP 왕복과 Neon upsert를 먼저 지불하면 안 된다.
     */
    it('알 수 없는 kind는 수급 전에 거절된다', async () => {
        const result = await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'nope' },
            ctx,
            rt
        );

        expect(result).toMatchObject({ error: 'invalid_args' });
        expect(ensureSymbolData).not.toHaveBeenCalled();
    });

    it('심볼 형태가 아니면 수급 전에 거절된다', async () => {
        const result = await runFreshAnalysisTool(
            { symbol: '!!', kind: 'news' },
            ctx,
            rt
        );

        expect(result).toMatchObject({ error: 'invalid_args' });
        expect(ensureSymbolData).not.toHaveBeenCalled();
    });
});

describe('캐시 히트를 fresh로 위장하지 않는다', () => {
    /**
     * 시스템 프롬프트는 `get_cached_analysis`가 `stale:true`를 돌려줬을 때 모델을
     * 이 툴로 보낸다. 같은 저장 분석이 `source:'fresh'` + `stale:false`로 되돌아오면
     * 모델은 자기가 방금 갱신했다고 믿고 단정적으로 말한다 — 그게 이 단언이 막는
     * 회귀다(변이 검증: 이 단언이 없으면 옛 버그 코드로 되돌려도 전 스위트 초록).
     */
    it("status:'cached'면 source:'cached'와 stale:null을 싣는다", async () => {
        m.overall.mockResolvedValue({
            status: 'cached',
            result: { headlineKo: 'h', analyzedAt: '2026-09-12T00:00:00.000Z' },
        });

        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'overall' },
            ctx,
            rt
        )) as { source: string; stale: unknown; generatedAt: string | null };

        expect(r.source).toBe('cached');
        expect(r.stale).toBeNull();
    });

    /**
     * 투영(`projectOverall` 등)이 `analyzedAt`을 버리므로 **투영 전 원본**에서
     * 읽어야 한다. 투영 결과에서 찾으면 항상 null이 되어 기능이 죽는다.
     */
    it('cached의 generatedAt은 투영 전 원본의 analyzedAt에서 온다', async () => {
        m.overall.mockResolvedValue({
            status: 'cached',
            result: { headlineKo: 'h', analyzedAt: '2026-09-12T00:00:00.000Z' },
        });

        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'overall' },
            ctx,
            rt
        )) as { generatedAt: string | null };

        expect(r.generatedAt).toBe('2026-09-12T00:00:00.000Z');
    });

    it('원본에 analyzedAt이 없으면 generatedAt은 null이다 — 지어내지 않는다', async () => {
        m.overall.mockResolvedValue({
            status: 'cached',
            result: { headlineKo: 'h' },
        });

        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'overall' },
            ctx,
            rt
        )) as { generatedAt: string | null };

        expect(r.generatedAt).toBeNull();
    });

    it("status:'done'은 그대로 fresh이고 stale:false다", async () => {
        m.overall.mockResolvedValue({
            status: 'done',
            result: { headlineKo: 'h' },
        });

        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'overall' },
            ctx,
            rt
        )) as { source: string; stale: unknown; generatedAt: string | null };

        expect(r.source).toBe('fresh');
        expect(r.stale).toBe(false);
        expect(typeof r.generatedAt).toBe('string');
    });
});

describe('cached generatedAt은 kind마다 신뢰도가 다르다', () => {
    const ANALYZED = '2026-09-12T00:00:00.000Z';

    it('technical: core가 analyzedAt을 보존하므로 싣는다', async () => {
        m.runAnalysis.mockResolvedValue({
            status: 'cached',
            result: {
                summary: 's',
                trend: 'bullish',
                riskLevel: 'low',
                keyLevels: { support: [], resistance: [] },
                priceTargets: { bullish: null, bearish: null },
                patternSummaries: [],
                strategyResults: [],
                candlePatterns: [],
                trendlines: [],
                indicatorResults: [],
                analyzedAt: ANALYZED,
            },
        });

        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'technical' },
            ctx,
            rt
        )) as { source: string; generatedAt: string | null };

        expect(r.source).toBe('cached');
        expect(r.generatedAt).toBe(ANALYZED);
    });

    /**
     * core의 `runOptionsAnalysis`는 캐시 항목을
     * `normalizeOptionsAnalysisResponse(cached, occurredAt)`로 다시 정규화하는데,
     * 그 함수가 `analyzedAt`을 **조회 시각으로 덮어쓴다**. 그대로 실으면
     * `source:'cached'` 옆에 지금 시각이 붙어, 이 수정이 없애려던 왜곡이 그대로
     * 남는다.
     */
    it('options: core가 조회 시각으로 덮어쓰므로 싣지 않는다', async () => {
        m.options.mockResolvedValue({
            status: 'cached',
            result: {
                summary: 's',
                signals: [],
                perExpiration: [],
                analyzedAt: new Date().toISOString(),
            },
        });

        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'options' },
            ctx,
            rt
        )) as { source: string; generatedAt: string | null };

        expect(r.source).toBe('cached');
        expect(r.generatedAt).toBeNull();
    });

    /**
     * `NewsAnalysisResponse`에는 `analyzedAt` 필드 자체가 없다. 그래도 픽스처에
     * **계약에 없는** `analyzedAt`을 일부러 심는다 — 안 심으면 이 테스트는
     * "필드가 없어서 null"만 증명하고, `news`를 신뢰 집합에 넣어도 그대로
     * 통과해 게이트 자체를 검증하지 못한다.
     */
    it('news: kind가 신뢰 집합 밖이라 값이 있어도 싣지 않는다', async () => {
        m.news.mockResolvedValue({
            status: 'cached',
            result: {
                currentDriverKo: 'd',
                keyEventsKo: [],
                upcomingEventsKo: [],
                overallSentiment: 'neutral',
                analyzedAt: ANALYZED,
            },
        });

        const r = (await runFreshAnalysisTool(
            { symbol: 'AAPL', kind: 'news' },
            ctx,
            rt
        )) as { source: string; generatedAt: string | null };

        expect(r.source).toBe('cached');
        expect(r.generatedAt).toBeNull();
    });
});
