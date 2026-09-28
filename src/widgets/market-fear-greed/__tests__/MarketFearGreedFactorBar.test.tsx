import { render } from '@testing-library/react';
import type { MarketFearGreedFactor } from '@y0ngha/siglens-core';
import { MarketFearGreedFactorBar } from '@/widgets/market-fear-greed/MarketFearGreedFactorBar';

import koMessages from '@/../messages/ko.json';

/** ko 카탈로그의 팩터 라벨·설명 — 소스 상수를 대체한다. */
const FG = koMessages.shared.lib.fearGreedFactor as unknown as {
    label: Record<string, string>;
    descriptionUs: Record<string, string>;
    symbolLabel: Record<string, string>;
};

import {} from '@/shared/lib/marketFearGreedLabels';

const momentumFactor: MarketFearGreedFactor = {
    key: 'momentum',
    rawValue: 0.0512,
    percentile: 80,
};

describe('MarketFearGreedFactorBar', () => {
    describe('with momentum factor', () => {
        it('renders the Korean factor name', () => {
            const { getByText } = render(
                <MarketFearGreedFactorBar market="us" factor={momentumFactor} />
            );
            expect(getByText(FG.label.momentum)).toBeInTheDocument();
        });

        it('renders the formatted signed raw value', () => {
            const { getByText } = render(
                <MarketFearGreedFactorBar market="us" factor={momentumFactor} />
            );
            expect(getByText('+5.12%')).toBeInTheDocument();
        });

        it('renders the rounded percentile number', () => {
            const { getByText } = render(
                <MarketFearGreedFactorBar market="us" factor={momentumFactor} />
            );
            expect(getByText(/백분위\s*80/)).toBeInTheDocument();
        });

        it('renders the factor description as accessible plain text', () => {
            const { getByText } = render(
                <MarketFearGreedFactorBar market="us" factor={momentumFactor} />
            );
            expect(getByText(FG.descriptionUs.momentum)).toBeInTheDocument();
        });

        it('exposes the percentile via an accessible progressbar', () => {
            const { getByRole } = render(
                <MarketFearGreedFactorBar market="us" factor={momentumFactor} />
            );
            const bar = getByRole('progressbar');
            expect(bar).toHaveAttribute('aria-valuenow', '80');
            expect(bar.getAttribute('aria-label')).toContain(FG.label.momentum);
        });
    });

    describe('with a negative raw value', () => {
        it('renders a leading minus sign', () => {
            const factor: MarketFearGreedFactor = {
                key: 'volatility',
                rawValue: -0.0314,
                percentile: 12,
            };
            const { getByText } = render(
                <MarketFearGreedFactorBar market="us" factor={factor} />
            );
            expect(getByText('-3.14%')).toBeInTheDocument();
        });
    });

    describe('renders every market factor label', () => {
        it.each([
            'momentum' as const,
            'volatility' as const,
            'safe_haven' as const,
            'junk_bond' as const,
            'breadth' as const,
        ])('renders the label for %s', key => {
            const factor: MarketFearGreedFactor = {
                key,
                rawValue: 0.01,
                percentile: 50,
            };
            const { getByText } = render(
                <MarketFearGreedFactorBar market="us" factor={factor} />
            );
            expect(
                getByText(FG.label[key === 'junk_bond' ? 'junk_bond_us' : key]!)
            ).toBeInTheDocument();
        });
    });
});
