import { describe, it, expect } from 'vitest';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { normalizeAnalysisResponse } from '@/entities/analysis/lib/normalizeAnalysisResponse';
import { FALLBACK_ANALYSIS, isFallbackAnalysis } from '@/entities/chat-message';

// 정적 타입은 모든 배열을 required로 선언하므로, 런타임 누락을 재현하려면
// 의도적으로 타입을 우회한 부분 객체를 만든다.
function partial(overrides: Record<string, unknown>): AnalysisResponse {
    return {
        summary: '요약',
        trend: 'bullish',
        riskLevel: 'medium',
        ...overrides,
    } as unknown as AnalysisResponse;
}

describe('normalizeAnalysisResponse', () => {
    it('fills missing array fields with empty arrays', () => {
        const result = normalizeAnalysisResponse(
            partial({
                indicatorResults: undefined,
                patternSummaries: undefined,
                strategyResults: undefined,
                candlePatterns: undefined,
                trendlines: undefined,
                keyLevels: undefined,
                priceTargets: undefined,
            })
        );

        expect(result.indicatorResults).toEqual([]);
        expect(result.patternSummaries).toEqual([]);
        expect(result.strategyResults).toEqual([]);
        expect(result.candlePatterns).toEqual([]);
        expect(result.trendlines).toEqual([]);
        expect(result.keyLevels).toEqual({ support: [], resistance: [] });
        expect(result.priceTargets).toEqual({ bullish: null, bearish: null });
    });

    it('defaults missing support/resistance inside a partial keyLevels object', () => {
        const result = normalizeAnalysisResponse(
            partial({
                keyLevels: { poc: { price: 210, reason: '거래량 중심' } },
            })
        );

        expect(result.keyLevels.support).toEqual([]);
        expect(result.keyLevels.resistance).toEqual([]);
        expect(result.keyLevels.poc).toEqual({
            price: 210,
            reason: '거래량 중심',
        });
    });

    it('preserves well-formed fields without overwriting them', () => {
        const wellFormed: AnalysisResponse = {
            summary: '요약',
            trend: 'bearish',
            riskLevel: 'high',
            indicatorResults: [{ indicatorName: 'RSI', signals: [] }],
            keyLevels: {
                support: [{ price: 100, reason: '지지' }],
                resistance: [{ price: 120, reason: '저항' }],
            },
            priceTargets: { bullish: null, bearish: null },
            patternSummaries: [],
            strategyResults: [],
            candlePatterns: [],
            trendlines: [
                {
                    direction: 'ascending',
                    start: { time: 1, price: 100 },
                    end: { time: 2, price: 110 },
                },
            ],
            analyzedAt: '2025-01-01T00:00:00Z',
        };

        const result = normalizeAnalysisResponse(wellFormed);

        expect(result.trend).toBe('bearish');
        expect(result.riskLevel).toBe('high');
        expect(result.indicatorResults).toHaveLength(1);
        expect(result.keyLevels.support).toHaveLength(1);
        expect(result.keyLevels.resistance).toHaveLength(1);
        expect(result.trendlines).toHaveLength(1);
        expect(result.analyzedAt).toBe('2025-01-01T00:00:00Z');
    });

    it('treats a null keyLevels as empty', () => {
        const result = normalizeAnalysisResponse(partial({ keyLevels: null }));

        expect(result.keyLevels).toEqual({ support: [], resistance: [] });
    });

    it('falls back to defaults when summary/trend/riskLevel are omitted, as a free-filtered response would', () => {
        // partial() always supplies summary/trend/riskLevel, which never
        // exercises the `??` fallbacks below. A tier-filtered response nulls
        // these fields out entirely, so build the input without them.
        const result = normalizeAnalysisResponse({
            indicatorResults: [],
            patternSummaries: [],
            strategyResults: [],
            candlePatterns: [],
            trendlines: [],
            keyLevels: { support: [], resistance: [] },
            priceTargets: { bullish: null, bearish: null },
        } as unknown as AnalysisResponse);

        expect(result.summary).toBe('');
        expect(result.trend).toBe('neutral');
        expect(result.riskLevel).toBe('medium');
    });

    // PR #685 round-3 blocker: `useAnalysis`가 실제로 호출하는 것은
    // `normalizeAnalysisResponse(analysisResult ?? initialAnalysis)`이지 FALLBACK_ANALYSIS를
    // 직접 prop으로 주입하는 게 아니다. normalizeAnalysisResponse는 `{ ...analysis }`로 항상
    // 새 객체를 반환하므로, 정규화를 통과한 뒤에도 isFallbackAnalysis가 fallback을 여전히
    // 감지해야 AnalysisPanel/ChartContent의 가드가 dead code가 아니게 된다. 이 테스트는
    // (직접 참조 주입이 아니라) 실제 경로를 통해 그 계약을 검증한다.
    it('normalizeAnalysisResponse(FALLBACK_ANALYSIS)를 거친 뒤에도 isFallbackAnalysis가 fallback으로 감지한다', () => {
        const normalized = normalizeAnalysisResponse(FALLBACK_ANALYSIS);

        // 스프레드로 새 객체가 됐으므로 참조는 이미 깨져 있다. 그럼에도 값 기반
        // isFallbackAnalysis는 true를 반환해야 한다.
        expect(normalized).not.toBe(FALLBACK_ANALYSIS);
        expect(isFallbackAnalysis(normalized)).toBe(true);
    });
});
