vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('../hooks/useAnalysisProgress', () => ({
    ANALYSIS_PHASES: ['차트 분석 중', '패턴 탐지 중', '결과 생성 중'],
    ANALYSIS_TIPS: ['팁 하나', '팁 둘', '팁 셋'],
}));
vi.mock('../AdBanner', () => ({
    AdBanner: () => <div data-testid="ad-banner" />,
}));

import { render, screen } from '@testing-library/react';

import { AnalysisProgress } from '../AnalysisProgress';

describe('AnalysisProgress', () => {
    it('renders the current phase message', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={0} />);

        expect(screen.getByText(/차트 분석 중/)).toBeInTheDocument();
    });

    it('renders the current tip', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={1} />);

        expect(screen.getByText('팁 둘')).toBeInTheDocument();
    });

    it('renders phase dots matching the number of phases', () => {
        const { container } = render(
            <AnalysisProgress phaseIndex={1} tipIndex={0} />
        );

        const dots = container.querySelectorAll('.rounded-full.h-1.flex-1');
        expect(dots).toHaveLength(3);
    });

    it('has a status role with aria-live', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={0} />);

        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status).toHaveAttribute('aria-label', 'AI 분석 진행 중');
    });

    it('renders the ad banner', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={0} />);

        expect(screen.getByTestId('ad-banner')).toBeInTheDocument();
    });
});
