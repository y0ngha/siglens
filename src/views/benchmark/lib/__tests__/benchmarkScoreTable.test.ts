import { describe, expect, it } from 'vitest';
import { BENCHMARK_EMPTY_CELL } from '@/shared/lib/benchmarkFormat';
import {
    toBenchmarkScoreCells,
    toBenchmarkScoreRows,
} from '../benchmarkScoreTable';

describe('toBenchmarkScoreRows', () => {
    it('keeps the key order and names each row', () => {
        expect(
            toBenchmarkScoreRows(
                ['us', 'kr'],
                { us: { a: 0.4 }, kr: { a: 0.3 } },
                { us: 'United States', kr: 'Korea' }
            )
        ).toEqual([
            { key: 'us', label: 'United States', scores: { a: 0.4 } },
            { key: 'kr', label: 'Korea', scores: { a: 0.3 } },
        ]);
    });

    it('falls back to the key and an empty score map', () => {
        expect(toBenchmarkScoreRows(['L9'], {}, {})).toEqual([
            { key: 'L9', label: 'L9', scores: {} },
        ]);
    });
});

describe('toBenchmarkScoreCells', () => {
    const row = (scores: Record<string, number | null>) => ({
        key: 'r',
        label: 'R',
        scores,
    });

    it('marks every cell that ties for the best displayed value', () => {
        expect(
            toBenchmarkScoreCells(row({ a: 0.8001, b: 0.8004, c: 0.5 }), [
                'a',
                'b',
                'c',
            ])
        ).toEqual([
            { targetId: 'a', text: '0.800', isBest: true },
            { targetId: 'b', text: '0.800', isBest: true },
            { targetId: 'c', text: '0.500', isBest: false },
        ]);
    });

    it('shows a placeholder for a missing or null score and never marks it', () => {
        expect(
            toBenchmarkScoreCells(row({ a: null, b: 0.25 }), ['a', 'b', 'z'])
        ).toEqual([
            { targetId: 'a', text: BENCHMARK_EMPTY_CELL, isBest: false },
            { targetId: 'b', text: '0.250', isBest: true },
            { targetId: 'z', text: BENCHMARK_EMPTY_CELL, isBest: false },
        ]);
    });

    it('marks nothing when the row has no scores', () => {
        expect(
            toBenchmarkScoreCells(row({}), ['a']).some(cell => cell.isBest)
        ).toBe(false);
    });
});
