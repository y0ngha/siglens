import { describe, expect, it } from 'vitest';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    regressionBarColor,
    squeezeMomentumColor,
    squeezeStateColor,
} from '@/widgets/chart/utils/histogramColorUtils';

describe('squeezeMomentumColor', () => {
    it('positive + increasing → strong up', () => {
        expect(squeezeMomentumColor(5, true)).toBe(
            CHART_COLORS.squeezeMomentumUp
        );
    });
    it('positive + not increasing → weak up', () => {
        expect(squeezeMomentumColor(5, false)).toBe(
            CHART_COLORS.squeezeMomentumUpWeak
        );
    });
    it('negative + increasing → weak down (recovering)', () => {
        expect(squeezeMomentumColor(-5, true)).toBe(
            CHART_COLORS.squeezeMomentumDownWeak
        );
    });
    it('negative + not increasing → strong down', () => {
        expect(squeezeMomentumColor(-5, false)).toBe(
            CHART_COLORS.squeezeMomentumDown
        );
    });
    it('zero counts as non-positive', () => {
        expect(squeezeMomentumColor(0, true)).toBe(
            CHART_COLORS.squeezeMomentumDownWeak
        );
        expect(squeezeMomentumColor(0, false)).toBe(
            CHART_COLORS.squeezeMomentumDown
        );
    });
    it('null increasing treated as not increasing', () => {
        expect(squeezeMomentumColor(5, null)).toBe(
            CHART_COLORS.squeezeMomentumUpWeak
        );
    });
});

describe('squeezeStateColor', () => {
    it('noSqz → squeezeNone (highest priority)', () => {
        expect(
            squeezeStateColor({ noSqz: true, sqzOn: true, sqzOff: false })
        ).toBe(CHART_COLORS.squeezeNone);
    });
    it('sqzOn → squeezeOn', () => {
        expect(
            squeezeStateColor({ noSqz: false, sqzOn: true, sqzOff: false })
        ).toBe(CHART_COLORS.squeezeOn);
    });
    it('sqzOff → squeezeOff', () => {
        expect(
            squeezeStateColor({ noSqz: false, sqzOn: false, sqzOff: true })
        ).toBe(CHART_COLORS.squeezeOff);
    });
    it('all false/null → null (no dot)', () => {
        expect(
            squeezeStateColor({ noSqz: false, sqzOn: false, sqzOff: false })
        ).toBeNull();
        expect(
            squeezeStateColor({ noSqz: null, sqzOn: null, sqzOff: null })
        ).toBeNull();
    });
});

describe('regressionBarColor', () => {
    it('positive slope → teal rgba with r2 alpha', () => {
        expect(regressionBarColor(2, 0.8)).toBe('rgba(38, 166, 154, 0.8)');
    });
    it('negative slope → red rgba with r2 alpha', () => {
        expect(regressionBarColor(-2, 0.5)).toBe('rgba(239, 83, 80, 0.5)');
    });
    it('clamps r2 into [0,1]', () => {
        expect(regressionBarColor(1, 1.7)).toBe('rgba(38, 166, 154, 1)');
        expect(regressionBarColor(1, -0.4)).toBe('rgba(38, 166, 154, 0)');
    });
    it('null r2 → fallback alpha 0.25', () => {
        expect(regressionBarColor(1, null)).toBe('rgba(38, 166, 154, 0.25)');
    });
});
