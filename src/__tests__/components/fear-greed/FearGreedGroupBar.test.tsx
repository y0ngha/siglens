/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import type { FearGreedGroup } from '@y0ngha/siglens-core';
import { FearGreedGroupBar } from '@/components/fear-greed/FearGreedGroupBar';

const flowGroup: FearGreedGroup = {
    name: 'Flow',
    score: 30.6,
    factors: [
        { key: 'volume_z', rawValue: -1.2, percentile: 80 },
        { key: 'buysell_imbalance', rawValue: 0.15, percentile: 60 },
        { key: 'poc_distance', rawValue: -0.05, percentile: 5 },
    ],
};

describe('FearGreedGroupBar', () => {
    describe('with Flow group', () => {
        it('renders group name and rounded score', () => {
            const { getByText } = render(
                <FearGreedGroupBar group={flowGroup} />
            );
            expect(getByText('Flow Group')).toBeInTheDocument();
            expect(getByText('31 / 100')).toBeInTheDocument(); // 30.6 rounded
        });

        it('renders all factors with formatted values and rounded percentiles', () => {
            const { getByText } = render(
                <FearGreedGroupBar group={flowGroup} />
            );
            expect(getByText(/거래량 z/)).toBeInTheDocument();
            expect(getByText(/Buy\/Sell 불균형/)).toBeInTheDocument();
            expect(getByText(/POC 거리/)).toBeInTheDocument();
            // percentile rendering
            expect(getByText(/80th/)).toBeInTheDocument();
        });

        it('exposes accessible bar score via aria-label', () => {
            const { container } = render(
                <FearGreedGroupBar group={flowGroup} />
            );
            const bar = container.querySelector('[aria-label]');
            expect(bar?.getAttribute('aria-label')).toBe('Flow 그룹 점수 31');
        });

        it('rounds score 0.4 down to 0', () => {
            const zeroish = { ...flowGroup, score: 0.4 };
            const { getByText } = render(<FearGreedGroupBar group={zeroish} />);
            expect(getByText('0 / 100')).toBeInTheDocument();
        });

        it('rounds score 99.6 up to 100', () => {
            const oneish = { ...flowGroup, score: 99.6 };
            const { getByText } = render(<FearGreedGroupBar group={oneish} />);
            expect(getByText('100 / 100')).toBeInTheDocument();
        });
    });
});
