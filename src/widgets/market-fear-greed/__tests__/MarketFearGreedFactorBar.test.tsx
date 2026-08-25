import { render } from '@testing-library/react';
import type { MarketFearGreedFactor } from '@y0ngha/siglens-core';
import { MarketFearGreedFactorBar } from '@/widgets/market-fear-greed/MarketFearGreedFactorBar';
import {
    MARKET_FACTOR_DESCRIPTION,
    MARKET_FACTOR_LABEL,
} from '@/shared/lib/marketFearGreedLabels';

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
            expect(
                getByText(MARKET_FACTOR_LABEL.us.momentum)
            ).toBeInTheDocument();
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
            expect(
                getByText(MARKET_FACTOR_DESCRIPTION.us.momentum)
            ).toBeInTheDocument();
        });

        it('exposes the percentile via an accessible progressbar', () => {
            const { getByRole } = render(
                <MarketFearGreedFactorBar market="us" factor={momentumFactor} />
            );
            const bar = getByRole('progressbar');
            expect(bar).toHaveAttribute('aria-valuenow', '80');
            expect(bar.getAttribute('aria-label')).toContain(
                MARKET_FACTOR_LABEL.us.momentum
            );
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

    describe('score-color fill', () => {
        // 밴드마다 정확히 하나의 클래스만 나와야 한다. `toContain`으로 문자열
        // 부분매치를 하면 `bg-ui-success`가 `bg-ui-success/70`의 부분 문자열이라
        // GREED/EXTREME_GREED 매핑이 한 칸씩 밀려도(예: BAR_FILL_COLOR가 통째로
        // 한 밴드씩 시프트) 계속 통과한다. 공백으로 토큰을 나눠 정확히 일치하는
        // 클래스만 확인하고, 나머지 4개 밴드 클래스는 없는지도 함께 못박는다.
        const ALL_BAND_CLASSES = [
            'bg-ui-danger',
            'bg-ui-warning',
            'bg-secondary-400',
            'bg-ui-success/85',
            'bg-ui-success',
        ] as const;

        it.each([
            ['EXTREME_FEAR', 10, 'bg-ui-danger'],
            ['FEAR', 30, 'bg-ui-warning'],
            ['NEUTRAL', 50, 'bg-secondary-400'],
            ['GREED', 65, 'bg-ui-success/85'],
            ['EXTREME_GREED', 85, 'bg-ui-success'],
        ] as const)(
            '%s(percentile=%d) → 정확히 %s 클래스만 렌더된다',
            (_bandName, percentile, expectedClass) => {
                const factor: MarketFearGreedFactor = {
                    key: 'breadth',
                    rawValue: 0.01,
                    percentile,
                };
                const { container } = render(
                    <MarketFearGreedFactorBar market="us" factor={factor} />
                );
                const fill = container.querySelector(
                    '[role="progressbar"] > div'
                );
                const classes = fill?.className.split(' ') ?? [];

                expect(classes).toContain(expectedClass);
                ALL_BAND_CLASSES.filter(cls => cls !== expectedClass).forEach(
                    otherClass => {
                        expect(classes).not.toContain(otherClass);
                    }
                );
            }
        );
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
            expect(getByText(MARKET_FACTOR_LABEL.us[key])).toBeInTheDocument();
        });
    });
});
