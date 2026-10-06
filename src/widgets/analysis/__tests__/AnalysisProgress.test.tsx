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
}));
vi.mock('../AdBanner', () => ({
    AdBanner: () => <div data-testid="ad-banner" />,
}));

import { render, screen } from '@testing-library/react';

import { AnalysisProgress } from '../AnalysisProgress';

// 진행 문구의 수는 상수가 아니라 호출부(종목 페이지)가 `countSkillFiles`에서 계산해 넘긴다.
const COUNTS = { indicatorCount: 37, skillCount: 89 };

describe('AnalysisProgress', () => {
    it('renders the current phase message', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={0} {...COUNTS} />);

        expect(screen.getByText('시장 데이터 정렬 중')).toBeInTheDocument();
    });

    it('renders the current tip', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={1} {...COUNTS} />);

        expect(
            screen.getByText(
                'AI 분석은 보통 5분 정도 걸려요. 길어지면 최대 15분까지 걸릴 수 있어요.'
            )
        ).toBeInTheDocument();
    });

    it('보조지표·스킬 수를 넘겨받은 값으로 진행 단계 문구에 채운다(이상 표현 없이)', () => {
        const { rerender } = render(
            <AnalysisProgress phaseIndex={1} tipIndex={0} {...COUNTS} />
        );
        expect(
            screen.getByText('37개 보조지표 시그널 분석 중')
        ).toBeInTheDocument();

        rerender(<AnalysisProgress phaseIndex={3} tipIndex={0} {...COUNTS} />);
        expect(
            screen.getByText('89개 스킬을 조합하여 시그널 매칭 중')
        ).toBeInTheDocument();
    });

    it('첫 팁이 보조지표·분석 스킬 수를 한 문장으로 말한다', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={0} {...COUNTS} />);

        expect(
            screen.getByText(
                '37종 보조지표와 89개 분석 스킬을 조합해 분석합니다.'
            )
        ).toBeInTheDocument();
    });

    it('renders phase dots matching the number of phases', () => {
        const { container } = render(
            <AnalysisProgress phaseIndex={1} tipIndex={0} {...COUNTS} />
        );

        const dots = container.querySelectorAll('.rounded-full.h-1.flex-1');
        // 단계 수는 가 정한다.
        expect(dots).toHaveLength(6);
    });

    it('has a status role with aria-live', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={0} {...COUNTS} />);

        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status).toHaveAttribute('aria-label', 'AI 분석 진행 중');
    });

    it('renders the ad banner', () => {
        render(<AnalysisProgress phaseIndex={0} tipIndex={0} {...COUNTS} />);

        expect(screen.getByTestId('ad-banner')).toBeInTheDocument();
    });
});
