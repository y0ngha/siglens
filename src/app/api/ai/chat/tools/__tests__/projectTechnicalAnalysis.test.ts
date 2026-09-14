import { describe, expect, it } from 'vitest';
import { projectTechnicalAnalysis } from '@/app/api/ai/chat/tools/projectTechnicalAnalysis';

const BASE = {
    summary: 's',
    trend: 'bullish' as const,
    riskLevel: 'medium' as const,
    keyLevels: {},
    priceTargets: {},
};

const pattern = (id: string, confidenceWeight: number, detected = true) => ({
    id,
    patternName: id,
    skillName: id,
    detected,
    trend: 'bullish' as const,
    summary: `summary-${id}`,
    confidenceWeight,
});

const strategy = (id: string, confidenceWeight: number) => ({
    id,
    strategyName: id,
    trend: 'bullish' as const,
    summary: `summary-${id}`,
    confidenceWeight,
});

const candle = (id: string, detected = true) => ({
    id,
    patternName: id,
    detected,
    trend: 'bullish' as const,
    summary: `summary-${id}`,
});

describe('projectTechnicalAnalysis', () => {
    it('drops indicatorResults/trendlines, keeps the untouched fields', () => {
        const r = projectTechnicalAnalysis({
            ...BASE,
            indicatorResults: [{ x: 1 }] as never,
            trendlines: [{ x: 1 }] as never,
            patternSummaries: [],
            strategyResults: [],
            candlePatterns: [],
        } as never);
        expect(r).not.toHaveProperty('indicatorResults');
        expect(r).not.toHaveProperty('trendlines');
        expect(r.summary).toBe('s');
        expect(r.trend).toBe('bullish');
        expect(r.riskLevel).toBe('medium');
        expect(r.actionRecommendation).toBeNull();
    });

    it('patterns: filters detected===false, sorts by confidenceWeight desc, caps at 5', () => {
        const patterns = [
            pattern('low', 0.2),
            pattern('undetected', 0.9, false),
            pattern('high', 0.8),
            pattern('mid', 0.5),
            pattern('p5', 0.4),
            pattern('p6', 0.3),
            pattern('p7', 0.1),
        ];
        const r = projectTechnicalAnalysis({
            ...BASE,
            patternSummaries: patterns,
            strategyResults: [],
            candlePatterns: [],
        } as never);
        expect(r.patterns).toHaveLength(5);
        expect(r.patterns.map(p => p.name)).toEqual([
            'high',
            'mid',
            'p5',
            'p6',
            'low',
        ]);
        expect(r.patterns[0]).toEqual({
            name: 'high',
            trend: 'bullish',
            confidence: 0.8,
            summary: 'summary-high',
        });
    });

    it('candlePatterns: filters detected===false, caps at 5, no sort by confidence (none carried)', () => {
        const candles = [
            candle('c1'),
            candle('c2', false),
            candle('c3'),
            candle('c4'),
            candle('c5'),
            candle('c6'),
        ];
        const r = projectTechnicalAnalysis({
            ...BASE,
            patternSummaries: [],
            strategyResults: [],
            candlePatterns: candles,
        } as never);
        expect(r.candlePatterns).toHaveLength(5);
        expect(r.candlePatterns.map(c => c.name)).toEqual([
            'c1',
            'c3',
            'c4',
            'c5',
            'c6',
        ]);
        expect(r.candlePatterns[0]).toEqual({
            name: 'c1',
            trend: 'bullish',
            summary: 'summary-c1',
        });
    });

    it('strategies: sorts by confidenceWeight desc, caps at 5', () => {
        const strategies = [
            strategy('low', 0.1),
            strategy('high', 0.9),
            strategy('mid', 0.5),
            strategy('s4', 0.4),
            strategy('s5', 0.3),
            strategy('s6', 0.2),
        ];
        const r = projectTechnicalAnalysis({
            ...BASE,
            patternSummaries: [],
            strategyResults: strategies,
            candlePatterns: [],
        } as never);
        expect(r.strategies).toHaveLength(5);
        expect(r.strategies.map(s => s.name)).toEqual([
            'high',
            'mid',
            's4',
            's5',
            's6',
        ]);
        expect(r.strategies[0]).toEqual({
            name: 'high',
            trend: 'bullish',
            summary: 'summary-high',
        });
    });

    it('tolerates null/undefined arrays (older cached payloads / tier-locked fragments)', () => {
        const r = projectTechnicalAnalysis({
            ...BASE,
            patternSummaries: null,
            strategyResults: undefined,
            candlePatterns: null,
        } as never);
        expect(r.patterns).toEqual([]);
        expect(r.strategies).toEqual([]);
        expect(r.candlePatterns).toEqual([]);
    });
});
