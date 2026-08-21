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

// AnalysisProgress가 내부 hook에서 직접 import하므로 여기서 mock한다.
vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    ANALYSIS_PHASE_COUNT: 6,
    ANALYSIS_TIP_COUNT: 8,
    PRO_INDICATOR_COUNT: 30,
    SKILL_COUNT: 60,
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

            // 문구는 카탈로그에서 온다 — mock 문자열이 아니라 실제 값을 단언한다.
            expect(
                screen.getByText('30개 이상의 보조지표 시그널 분석 중')
            ).toBeInTheDocument();
        });

        it('displays current tip', () => {
            render(<AnalysisProgress phaseIndex={0} tipIndex={1} />);

            expect(
                screen.getByText(
                    'AI 분석은 보통 5분 정도 걸려요. 길어지면 최대 15분까지 걸릴 수 있어요.'
                )
            ).toBeInTheDocument();
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
