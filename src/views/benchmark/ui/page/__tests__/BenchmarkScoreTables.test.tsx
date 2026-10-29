import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BenchmarkTarget } from '@/entities/benchmark/types';
import { BenchmarkScoreTable } from '../BenchmarkScoreTables';

const TARGETS: readonly BenchmarkTarget[] = [
    { id: 'a', label: 'AlphaAI', model: 'm1', isBaseline: false },
    { id: 'b', label: 'BetaGPT', model: 'm2', isBaseline: false },
    { id: 'c', label: 'GammaGem', model: 'm3', isBaseline: false },
];

function cells(scores: Record<string, number | null>): HTMLElement[] {
    render(
        <BenchmarkScoreTable
            caption="cap"
            rowHeader="row"
            targets={TARGETS}
            rows={[{ key: 'r', label: 'R', scores }]}
        />
    );
    const row = screen.getByText('R').closest('tr')!;
    return within(row).getAllByRole('cell');
}

const isBold = (cell: HTMLElement) => cell.className.includes('font-semibold');

describe('BenchmarkScoreTable best-value emphasis', () => {
    it('bolds every cell whose displayed value ties for the best', () => {
        // 0.8001과 0.8004는 모두 화면에 0.800으로 찍힌다 — 동점이라 둘 다 굵다.
        const result = cells({ a: 0.8001, b: 0.8004, c: 0.5 });
        expect(result.map(isBold)).toEqual([true, true, false]);
    });

    it('does not bold a value that only looks lower before rounding', () => {
        const result = cells({ a: 0.7996, b: 0.8, c: 0.1 });
        expect(result.map(c => c.textContent)).toEqual([
            '0.800',
            '0.800',
            '0.100',
        ]);
        expect(result.map(isBold)).toEqual([true, true, false]);
    });

    it('bolds nothing when every cell is empty', () => {
        const result = cells({ a: null, b: null, c: null });
        expect(result.some(isBold)).toBe(false);
    });
});
