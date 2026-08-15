import { render } from '@testing-library/react';
import type { MarketFearGreedComparisonPoint } from '@/entities/market-fear-greed';
import { MarketFearGreedComparison } from '@/widgets/market-fear-greed/MarketFearGreedComparison';

const comparisons: MarketFearGreedComparisonPoint[] = [
    { key: 'now', date: '2026-08-14', score: 62, label: 'GREED' },
    { key: '1w', date: '2026-08-07', score: 58, label: 'GREED' },
    { key: '1m', date: '2026-07-15', score: 40, label: 'FEAR' },
    { key: '1y', date: '2025-08-14', score: 25, label: 'EXTREME_FEAR' },
];

describe('MarketFearGreedComparison', () => {
    describe('with all 4 comparison points', () => {
        it('renders all four period labels', () => {
            const { getByText } = render(
                <MarketFearGreedComparison comparisons={comparisons} />
            );
            expect(getByText('현재')).toBeInTheDocument();
            expect(getByText('1주 전')).toBeInTheDocument();
            expect(getByText('1개월 전')).toBeInTheDocument();
            expect(getByText('1년 전')).toBeInTheDocument();
        });

        it('renders 4 accessible mini gauges', () => {
            const { container } = render(
                <MarketFearGreedComparison comparisons={comparisons} />
            );
            const svgs = container.querySelectorAll('svg[role="img"]');
            expect(svgs).toHaveLength(4);
        });
    });

    describe('with a short array', () => {
        it('renders only the available points without throwing', () => {
            const { getByText, queryByText, container } = render(
                <MarketFearGreedComparison
                    comparisons={comparisons.slice(0, 2)}
                />
            );
            expect(getByText('현재')).toBeInTheDocument();
            expect(getByText('1주 전')).toBeInTheDocument();
            expect(queryByText('1개월 전')).not.toBeInTheDocument();
            expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(
                2
            );
        });
    });

    describe('with an empty array', () => {
        it('renders nothing', () => {
            const { container } = render(
                <MarketFearGreedComparison comparisons={[]} />
            );
            expect(container.firstChild).toBeNull();
        });
    });
});
