/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { FearGreedComparisonGauges } from '@/components/fear-greed/FearGreedComparisonGauges';

function makeHistory(scores: Array<number | null>): FearGreedHistoryPoint[] {
    return scores.map((s, i) => ({
        date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
        score: s,
        label: s !== null && s >= 50 ? 'GREED' : 'FEAR',
    }));
}

describe('FearGreedComparisonGauges', () => {
    describe('with sufficient history', () => {
        it('renders 4 mini gauges with rounded scores and period labels', () => {
            const history = makeHistory(
                Array.from({ length: 300 }, (_, i) => 50 + (i % 20))
            );
            const { getByText, container } = render(
                <FearGreedComparisonGauges history={history} />
            );
            expect(getByText('현재')).toBeInTheDocument();
            expect(getByText('1주')).toBeInTheDocument();
            expect(getByText('1개월')).toBeInTheDocument();
            expect(getByText('1년')).toBeInTheDocument();
            // 4 mini gauges — each must show a rounded numeric score in a tabular-nums div
            const scoreNodes = container.querySelectorAll('.tabular-nums');
            expect(scoreNodes).toHaveLength(4);
            scoreNodes.forEach(node => {
                expect(node.textContent).toMatch(/^\d+$/);
            });
            // 4 mini gauges → 4 SVG role="img" elements
            const svgs = container.querySelectorAll('svg[role="img"]');
            expect(svgs).toHaveLength(4);
        });
    });

    describe('with insufficient history', () => {
        it('clamps to first valid entry when daysBack exceeds available data', () => {
            const history = makeHistory(
                Array.from({ length: 10 }, (_, i) => 30 + i)
            );
            const { getAllByText } = render(
                <FearGreedComparisonGauges history={history} />
            );
            // 1m and 1y tiles both show the oldest valid score (30) due to clamping
            expect(getAllByText('30').length).toBeGreaterThanOrEqual(1);
        });

        it('returns null when all scores are null (warm-up only)', () => {
            const history = makeHistory(Array.from({ length: 5 }, () => null));
            const { container } = render(
                <FearGreedComparisonGauges history={history} />
            );
            expect(container.firstChild).toBeNull();
        });
    });
});
