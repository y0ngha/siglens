import { describe, expect, it } from 'vitest';
import {
    BENCHMARK_EMPTY_CELL,
    formatBenchmarkCi,
    formatBenchmarkContrast,
    formatBenchmarkDate,
    formatBenchmarkDiff,
    formatBenchmarkP,
    formatBenchmarkScore,
    roundBenchmarkScore,
} from '../benchmarkFormat';

describe('formatBenchmarkScore', () => {
    it('pads to three decimals', () => {
        expect(formatBenchmarkScore(0.5)).toBe('0.500');
    });

    it('uses a true minus sign for negatives', () => {
        expect(formatBenchmarkScore(-0.1234)).toBe('−0.123');
    });

    it('renders null as the empty cell', () => {
        expect(formatBenchmarkScore(null)).toBe(BENCHMARK_EMPTY_CELL);
    });

    it('never renders a negative zero', () => {
        expect(formatBenchmarkScore(-0.0004)).toBe('0.000');
        expect(formatBenchmarkScore(-0)).toBe('0.000');
    });
});

describe('roundBenchmarkScore', () => {
    it('rounds to the displayed three decimals', () => {
        expect(roundBenchmarkScore(0.12349)).toBe(0.123);
    });

    it('turns values that display as zero into a plain zero', () => {
        expect(Object.is(roundBenchmarkScore(-0.0004), 0)).toBe(true);
    });
});

describe('formatBenchmarkContrast', () => {
    it('builds the diff, interval and p strings from raw numbers', () => {
        expect(
            formatBenchmarkContrast({
                diff: 0.1234,
                ci95: [0.05, 0.2],
                pHolm: 0.0042,
            })
        ).toEqual({
            diffText: '+0.123',
            ciText: '[+0.050, +0.200]',
            pText: '0.004',
        });
    });

    it('shows the empty cell for an untested comparison', () => {
        expect(
            formatBenchmarkContrast({ diff: 0, ci95: [0, 0], pHolm: null })
                .pText
        ).toBe(BENCHMARK_EMPTY_CELL);
    });
});

describe('formatBenchmarkDiff', () => {
    it('prefixes a plus on positives', () => {
        expect(formatBenchmarkDiff(0.1234)).toBe('+0.123');
    });

    it('uses a true minus on negatives', () => {
        expect(formatBenchmarkDiff(-0.0376)).toBe('−0.038');
    });

    it('drops the sign when the value rounds to zero', () => {
        expect(formatBenchmarkDiff(0.0004)).toBe('0.000');
        expect(formatBenchmarkDiff(-0.0004)).toBe('0.000');
    });
});

describe('formatBenchmarkCi', () => {
    it('formats both bounds as signed diffs', () => {
        expect(formatBenchmarkCi([-0.11, 0.02])).toBe('[−0.110, +0.020]');
    });
});

describe('formatBenchmarkP', () => {
    it('shows three decimals', () => {
        expect(formatBenchmarkP(0.0425)).toBe('0.043');
    });

    it('floors tiny values at <0.001', () => {
        expect(formatBenchmarkP(0.0004)).toBe('<0.001');
    });

    it('does not mark exactly 0.001 as tiny', () => {
        expect(formatBenchmarkP(0.001)).toBe('0.001');
    });

    it('renders an untested comparison as the empty cell', () => {
        expect(formatBenchmarkP(null)).toBe(BENCHMARK_EMPTY_CELL);
    });
});

describe('formatBenchmarkDate', () => {
    it('keeps only the date part of an ISO timestamp', () => {
        expect(formatBenchmarkDate('2099-01-12T03:04:05Z')).toBe('2099-01-12');
    });
});
