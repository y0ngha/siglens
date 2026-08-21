vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
// SENTIMENT_LABEL_KEY는 실제 `shared.enumLabel` 카탈로그 키 문자열이다 —
// 이 값 자체를 mock으로 지어내면 실제 tLabel(useTranslations)이 조회에
// 실패해 MISSING_MESSAGE로 렌더된다. fearGreedLabels 모듈은 계속 mock하되
// (WARNING_TEXT/FACTOR_LABEL 등 무관한 export까지 끌어오지 않기 위해),
// 키 값만 실제와 동일하게 유지한다.
vi.mock('@/shared/lib/fearGreedLabels', () => ({
    SENTIMENT_LABEL_KEY: {
        EXTREME_FEAR: 'fearGreed.extremeFear',
        FEAR: 'fearGreed.fear',
        NEUTRAL: 'fearGreed.neutral',
        GREED: 'fearGreed.greed',
        EXTREME_GREED: 'fearGreed.extremeGreed',
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
