import { render } from '@testing-library/react';
import type { MarketFearGreedViewSnapshot } from '@/entities/market-fear-greed/model';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { MarketFearGreedHero } from '@/widgets/market-fear-greed/ui/hero/MarketFearGreedHero';

const snapshot: MarketFearGreedViewSnapshot = {
    score: 61.6,
    label: 'GREED',
    confidence: 'normal',
    sampleSize: 412,
    asOf: '2026-08-04',
    factors: [],
};

describe('MarketFearGreedHero', () => {
    it('renders the rounded score in the hero gauge name', () => {
        const { getByRole } = render(
            <MarketFearGreedHero snapshot={snapshot} />
        );
        expect(getByRole('img').getAttribute('aria-label')).toContain('62');
    });

    it('renders the as-of close date in Korean order', () => {
        const { getByText } = render(
            <MarketFearGreedHero snapshot={snapshot} />
        );
        expect(getByText('2026년 8월 4일 종가 기준')).toBeInTheDocument();
    });

    it('renders the as-of close date in the en catalog order', () => {
        const { getByText } = renderWithIntl(
            <MarketFearGreedHero snapshot={snapshot} />,
            { locale: 'en' }
        );
        expect(getByText('As of the close on 8/4/2026')).toBeInTheDocument();
    });
});
