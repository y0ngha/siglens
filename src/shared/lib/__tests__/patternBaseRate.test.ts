import {
    CANDLE_BASE_RATES,
    PATTERN_BASE_RATES,
    PRICE_LEVEL_BASE_RATE,
    measuredBaseRateFor,
    type MeasuredBaseRate,
} from '@y0ngha/siglens-core';
import {
    baseRateScopeYears,
    formatShareAsPercent,
    isPooledBaseRate,
    isTargetReferenceOnly,
    resolvePatternBaseRate,
} from '@/shared/lib/patternBaseRate';

const ROW: MeasuredBaseRate = {
    ...PRICE_LEVEL_BASE_RATE,
    subject: 'chart_pattern',
    key: 'double_bottom',
};

describe('isPooledBaseRate', () => {
    it('marks exactly the shipped rows core substituted with the all-pattern or all-candle row', () => {
        const rows = [
            ...Object.values(PATTERN_BASE_RATES),
            ...Object.values(CANDLE_BASE_RATES),
        ].flatMap(rate => (rate === undefined ? [] : [rate]));
        const pooled = rows.filter(isPooledBaseRate);
        expect(pooled.length).toBeGreaterThan(0);
        expect(pooled.every(rate => rate.key === 'pooled')).toBe(true);
        expect(
            rows.filter(rate => !isPooledBaseRate(rate)).length
        ).toBeGreaterThan(0);
        expect(PATTERN_BASE_RATES.bull_flag).toBeDefined();
        expect(isPooledBaseRate(PATTERN_BASE_RATES.bull_flag ?? ROW)).toBe(
            true
        );
    });

    it('does not call a pattern-own row pooled just because its verdict is insufficient_sample', () => {
        expect(
            isPooledBaseRate({ ...ROW, verdict: 'insufficient_sample' })
        ).toBe(false);
    });
});

describe('resolvePatternBaseRate', () => {
    it('keeps the row core attached to the card', () => {
        expect(
            resolvePatternBaseRate(
                {
                    skillName: '이중바닥',
                    patternName: 'double_bottom',
                    baseRate: ROW,
                },
                '1Day'
            )
        ).toBe(ROW);
    });

    it('keeps an explicit null: core measured nothing off daily bars', () => {
        expect(
            resolvePatternBaseRate(
                {
                    skillName: '이중바닥',
                    patternName: 'double_bottom',
                    baseRate: null,
                },
                '1Day'
            )
        ).toBeNull();
    });

    it('fills an old card without the field from the table of its timeframe', () => {
        const filled = resolvePatternBaseRate(
            { skillName: '헤드앤숄더', patternName: 'head_and_shoulders' },
            '1Day'
        );
        expect(filled).toEqual(
            measuredBaseRateFor('chart_pattern', 'head_and_shoulders', '1Day')
        );
        expect(filled?.key).toBe('head_and_shoulders');
    });

    it('gives an old card with an unknown pattern name the pooled row', () => {
        expect(
            resolvePatternBaseRate(
                { skillName: 'unknown skill', patternName: 'not_a_pattern' },
                '1Day'
            )?.key
        ).toBe('pooled');
    });

    it('is not measured for an old card on an intraday chart', () => {
        expect(
            resolvePatternBaseRate(
                { skillName: '이중바닥', patternName: 'double_bottom' },
                '1Hour'
            )
        ).toBeNull();
    });
});

describe('resolvePatternBaseRate key (catalog id, not model text)', () => {
    it('resolves a localized or free-form patternName through the skill catalog to the family row', () => {
        const resolved = resolvePatternBaseRate(
            {
                skillName: '헤드앤숄더',
                patternName: '헤드 앤 숄더 (모델 표기)',
            },
            '1Day'
        );
        expect(resolved?.key).toBe('head_and_shoulders');
        expect(resolved).toEqual(
            measuredBaseRateFor('chart_pattern', 'head_and_shoulders', '1Day')
        );
    });

    it('prefers the catalog id over a patternName that names another family', () => {
        expect(
            resolvePatternBaseRate(
                { skillName: '이중바닥', patternName: 'head_and_shoulders' },
                '1Day'
            )?.key
        ).toBe('double_bottom');
    });

    it('falls back to patternName only when it is an exact ChartPatternId', () => {
        expect(
            resolvePatternBaseRate(
                { skillName: 'not in the catalog', patternName: 'double_top' },
                '1Day'
            )?.key
        ).toBe('double_top');
    });

    it('never treats a prototype key as an id: unknown skill and unknown name give the pooled row', () => {
        expect(
            resolvePatternBaseRate(
                { skillName: 'constructor', patternName: 'toString' },
                '1Day'
            )?.key
        ).toBe('pooled');
    });
});

describe('isTargetReferenceOnly', () => {
    it('is false only when the row beats the placebo', () => {
        expect(
            isTargetReferenceOnly({ ...ROW, verdict: 'beats_placebo' })
        ).toBe(false);
    });

    it.each(['no_edge', 'insufficient_sample'] as const)(
        'is true for %s',
        verdict => {
            expect(isTargetReferenceOnly({ ...ROW, verdict })).toBe(true);
        }
    );

    it('is true when nothing was measured', () => {
        expect(isTargetReferenceOnly(null)).toBe(true);
        expect(isTargetReferenceOnly(undefined)).toBe(true);
    });
});

describe('formatShareAsPercent', () => {
    it('rounds a share to one decimal', () => {
        expect(formatShareAsPercent(0.225932)).toBe('22.6');
        expect(formatShareAsPercent(0.5)).toBe('50.0');
    });
});

describe('baseRateScopeYears', () => {
    it('reads the years out of the scope dates', () => {
        expect(baseRateScopeYears(PRICE_LEVEL_BASE_RATE)).toEqual({
            from: PRICE_LEVEL_BASE_RATE.scope.from.slice(0, 4),
            to: PRICE_LEVEL_BASE_RATE.scope.to.slice(0, 4),
        });
    });
});
