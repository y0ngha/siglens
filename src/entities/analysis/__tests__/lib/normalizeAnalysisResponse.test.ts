import { describe, it, expect } from 'vitest';
import type { AnalysisResponse } from '@y0ngha/siglens-core';
import { normalizeAnalysisResponse } from '@/entities/analysis/lib/normalizeAnalysisResponse';

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
});
