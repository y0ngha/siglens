import { describe, expect, it } from 'vitest';
import {
    narrowCycleReading,
    narrowTechnicalContent,
} from '../../lib/technicalContent';

const CYCLE = {
    kind: 'ma_cycle',
    stage: 2,
    previousStage: 1,
    barsInStage: null,
    progression: 'forward',
    stageChanges: 3,
    values: { ma5: 10.5, ma20: 11, ma60: 9.75 },
    order: ['medium', 'short', 'long'],
    slopes: { ma5: 'falling', ma20: null, ma60: 'flat' },
};

describe('narrowCycleReading', () => {
    it('accepts a well-formed reading, including a null duration and null slopes', () => {
        expect(narrowCycleReading(CYCLE)).toEqual(CYCLE);
    });

    it('accepts a macd cycle without an order', () => {
        const { order: _order, ...macd } = CYCLE;
        expect(
            narrowCycleReading({ ...macd, kind: 'macd_cycle' })
        ).not.toBeNull();
    });

    it.each([
        ['null', null],
        ['not an object', 'ma_cycle'],
        ['unknown kind', { ...CYCLE, kind: 'future_cycle' }],
        ['stage 0', { ...CYCLE, stage: 0 }],
        ['stage 7', { ...CYCLE, stage: 7 }],
        ['fractional stage', { ...CYCLE, stage: 1.5 }],
        ['previous stage out of range', { ...CYCLE, previousStage: 9 }],
        ['previous stage missing', { ...CYCLE, previousStage: undefined }],
        ['negative duration', { ...CYCLE, barsInStage: -1 }],
        ['unknown progression', { ...CYCLE, progression: 'sideways' }],
        ['non-numeric stage changes', { ...CYCLE, stageChanges: '3' }],
        ['non-numeric value', { ...CYCLE, values: { ma5: '10.5' } }],
        ['values missing', { ...CYCLE, values: undefined }],
        ['unknown slope', { ...CYCLE, slopes: { ma5: 'sideways' } }],
        ['slopes missing', { ...CYCLE, slopes: undefined }],
        ['unknown order role', { ...CYCLE, order: ['short', 'tiny'] }],
        ['order not an array', { ...CYCLE, order: 'short' }],
    ])('rejects %s', (_label, value) => {
        expect(narrowCycleReading(value)).toBeNull();
    });
});

describe('narrowTechnicalContent', () => {
    const pattern = (detected: unknown, summary = '패턴 요약') => ({
        patternName: 'double_top',
        detected,
        trend: 'bearish',
        summary,
    });

    it('keeps only detected patterns', () => {
        const narrowed = narrowTechnicalContent({
            summary: '요약',
            patternSummaries: [
                pattern(false, '보이지 않아요'),
                pattern(undefined, '옛 행'),
                pattern('true', '문자열 true'),
                pattern(true, '보여요'),
            ],
        });
        expect(narrowed?.patternSummaries.map(p => p.summary)).toEqual([
            '보여요',
        ]);
    });

    it('is not prose when the only evidence is an undetected pattern', () => {
        expect(
            narrowTechnicalContent({
                summary: '',
                patternSummaries: [pattern(false)],
            })
        ).toBeNull();
    });

    it('carries a valid cycle on a strategy and drops a corrupt one', () => {
        const narrowed = narrowTechnicalContent({
            summary: '요약',
            strategyResults: [
                {
                    strategyName: 'a',
                    trend: 'bullish',
                    summary: 'English line',
                    cycle: CYCLE,
                },
                {
                    strategyName: 'b',
                    trend: 'bullish',
                    summary: 'English line',
                    cycle: { ...CYCLE, stage: 99 },
                },
                { strategyName: 'c', trend: 'bullish', summary: '모델 요약' },
            ],
        });
        expect(narrowed?.strategyResults.map(s => s.cycle !== null)).toEqual([
            true,
            false,
            false,
        ]);
    });

    it('never reads a cycle off a pattern entry', () => {
        const narrowed = narrowTechnicalContent({
            summary: '요약',
            patternSummaries: [{ ...pattern(true), cycle: CYCLE }],
        });
        expect(narrowed?.patternSummaries[0]?.cycle).toBeNull();
    });
});
