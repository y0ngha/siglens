import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsAiSummaryError } from '@/widgets/news/NewsAiSummaryError';
import { AnalysisProgress } from '@/widgets/analysis/AnalysisProgress';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

// Spec-2 PR-B1: ANALYSIS_PHASES / ANALYSIS_TIPS는 widgets/analysis로 이전.
// AnalysisProgress가 내부 hook에서 직접 import하므로 여기서 mock한다.
vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    ANALYSIS_PHASES: [
        '데이터 수집',
        '패턴 분석',
        '시그널 종합',
        'AI 판단',
        '보고서 작성',
    ],
    ANALYSIS_TIPS: ['팁 1', '팁 2'],
}));

vi.mock('./AdBanner', () => ({
    AdBanner: () => null,
}));

describe('Journey: Error Recovery', () => {
    describe('News error fallback — NewsAiSummaryError', () => {
        it('renders error message from Error instance', () => {
            const error = new Error('뉴스를 불러올 수 없습니다.');
            render(
                <NewsAiSummaryError
                    error={error}
                    resetErrorBoundary={vi.fn()}
                />
            );
            expect(
                screen.getByText('뉴스를 불러올 수 없습니다.')
            ).toBeInTheDocument();
        });

        it('renders retry button', () => {
            const error = new Error('네트워크 오류');
            render(
                <NewsAiSummaryError
                    error={error}
                    resetErrorBoundary={vi.fn()}
                />
            );
            expect(
                screen.getByRole('button', { name: '다시 시도' })
            ).toBeInTheDocument();
        });

        it('calls resetErrorBoundary on retry click', async () => {
            const resetFn = vi.fn();
            const error = new Error('오류');
            render(
                <NewsAiSummaryError
                    error={error}
                    resetErrorBoundary={resetFn}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByRole('button', { name: '다시 시도' }));
            expect(resetFn).toHaveBeenCalledTimes(1);
        });

        it('renders default message for non-Error values', () => {
            render(
                <NewsAiSummaryError
                    error="string error"
                    resetErrorBoundary={vi.fn()}
                />
            );
            expect(
                screen.getByText('분석 중 오류가 발생했습니다.')
            ).toBeInTheDocument();
        });

        it('has accessible alert role', () => {
            const error = new Error('오류');
            render(
                <NewsAiSummaryError
                    error={error}
                    resetErrorBoundary={vi.fn()}
                />
            );
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    describe('Analysis progress indicator — AnalysisProgress', () => {
        it('renders progress status with aria attributes', () => {
            render(<AnalysisProgress phaseIndex={0} tipIndex={0} />);
            expect(
                screen.getByRole('status', { name: 'AI 분석 진행 중' })
            ).toBeInTheDocument();
        });

        it('displays current phase message', () => {
            render(<AnalysisProgress phaseIndex={1} tipIndex={0} />);
            expect(screen.getByText('패턴 분석')).toBeInTheDocument();
        });

        it('displays current tip', () => {
            render(<AnalysisProgress phaseIndex={0} tipIndex={1} />);
            expect(screen.getByText('팁 2')).toBeInTheDocument();
        });
    });

    describe('Error -> Retry -> Recovery transition', () => {
        it('transitions from news error to recovered state', () => {
            const resetFn = vi.fn();
            const error = new Error('뉴스를 불러올 수 없습니다.');
            const { rerender } = render(
                <NewsAiSummaryError
                    error={error}
                    resetErrorBoundary={resetFn}
                />
            );
            expect(
                screen.getByText('뉴스를 불러올 수 없습니다.')
            ).toBeInTheDocument();

            rerender(<div data-testid="news-recovered">뉴스 목록</div>);
            expect(screen.getByTestId('news-recovered')).toBeInTheDocument();
            expect(
                screen.queryByText('뉴스를 불러올 수 없습니다.')
            ).not.toBeInTheDocument();
        });
    });
});
