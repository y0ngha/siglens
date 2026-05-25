vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/lib/fearGreedLabels', () => ({
    SENTIMENT_LABEL_TEXT: {
        EXTREME_FEAR: '극심한 공포',
        FEAR: '공포',
        NEUTRAL: '중립',
        GREED: '탐욕',
        EXTREME_GREED: '극심한 탐욕',
    },
}));
vi.mock('@/entities/fear-greed', () => ({
    FEAR_GREED_SCORE_BOUNDARIES: {
        EXTREME_FEAR_MAX: 25,
        FEAR_MAX: 40,
        NEUTRAL_MAX: 60,
        GREED_MAX: 75,
    },
}));
vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span data-testid="info-tooltip">{children}</span>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { FearGreedGauge } from '../FearGreedGauge';

describe('FearGreedGauge', () => {
    it('renders the score for hero size', () => {
        render(<FearGreedGauge score={72} label="GREED" size="hero" />);

        expect(screen.getByText('72')).toBeInTheDocument();
        expect(screen.getByText('/ 100')).toBeInTheDocument();
    });

    it('renders the sentiment label for hero size', () => {
        render(<FearGreedGauge score={15} label="EXTREME_FEAR" size="hero" />);

        expect(screen.getByText('극심한 공포')).toBeInTheDocument();
    });

    it('renders the score for mini size without sentiment label', () => {
        render(<FearGreedGauge score={50} label="NEUTRAL" size="mini" />);

        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.queryByText('중립')).not.toBeInTheDocument();
    });

    it('renders periodLabel for mini size', () => {
        render(
            <FearGreedGauge
                score={50}
                label="NEUTRAL"
                size="mini"
                periodLabel="1주"
            />
        );

        expect(screen.getByText('1주')).toBeInTheDocument();
    });

    it('renders confidence badge for hero size', () => {
        render(
            <FearGreedGauge
                score={72}
                label="GREED"
                size="hero"
                confidence="normal"
            />
        );

        expect(screen.getByText('신뢰도 정상')).toBeInTheDocument();
    });

    it('renders limited confidence badge', () => {
        render(
            <FearGreedGauge
                score={30}
                label="FEAR"
                size="hero"
                confidence="limited"
            />
        );

        expect(screen.getByText('신뢰도 제한')).toBeInTheDocument();
    });

    it('has an accessible SVG label', () => {
        render(<FearGreedGauge score={72} label="GREED" size="hero" />);

        const svg = screen.getByRole('img');
        expect(svg).toHaveAttribute(
            'aria-label',
            expect.stringContaining('공포 탐욕 지수 72점')
        );
    });
});
