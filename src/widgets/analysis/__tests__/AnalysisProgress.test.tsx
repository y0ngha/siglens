vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('../hooks/useAnalysisProgress', () => ({
    ANALYSIS_PHASE_COUNT: 6,
    ANALYSIS_TIP_COUNT: 8,
    PRO_INDICATOR_COUNT: 30,
    SKILL_COUNT: 60,
}));
vi.mock('../AdBanner', () => ({
    AdBanner: () => <div data-testid="ad-banner" />,
}));

import { render, screen } from '@testing-library/react';

import { AnalysisProgress } from '../AnalysisProgress';

describe('AnalysisProgress', () => {
    it('renders the current phase message', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={0} />);

        expect(screen.getByText('시장 데이터 정렬 중')).toBeInTheDocument();
    });

    it('renders the current tip', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={1} />);

        expect(
            screen.getByText(
                'AI 분석은 보통 5분 정도 걸려요. 길어지면 최대 15분까지 걸릴 수 있어요.'
            )
        ).toBeInTheDocument();
    });

    it('renders phase dots matching the number of phases', () => {
        const { container } = render(
            <AnalysisProgress phaseIndex={1} tipIndex={0} />
        );

        const dots = container.querySelectorAll('.rounded-full.h-1.flex-1');
        // 단계 수는 가 정한다.
        expect(dots).toHaveLength(6);
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
