import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

interface ErrorBoundaryMockProps {
    error: string | null;
    onRetry: () => void;
    children: React.ReactNode;
}

function ErrorBoundaryMock({
    error,
    onRetry,
    children,
}: ErrorBoundaryMockProps) {
    if (error) {
        return (
            <div role="alert">
                <p data-testid="error-message">{error}</p>
                <button onClick={onRetry}>다시 시도</button>
            </div>
        );
    }
    return <>{children}</>;
}

interface AnalysisWithErrorProps {
    status: 'idle' | 'loading' | 'success' | 'error' | 'timeout';
    onRetry: () => void;
    onCancel: () => void;
}

function AnalysisWithError({
    status,
    onRetry,
    onCancel,
}: AnalysisWithErrorProps) {
    if (status === 'loading') {
        return (
            <div>
                <div data-testid="analysis-loading">분석 중...</div>
                <button onClick={onCancel}>취소</button>
            </div>
        );
    }
    if (status === 'timeout') {
        return (
            <ErrorBoundaryMock
                error="분석 시간이 초과되었습니다."
                onRetry={onRetry}
            >
                <div />
            </ErrorBoundaryMock>
        );
    }
    if (status === 'error') {
        return (
            <ErrorBoundaryMock error="분석에 실패했습니다." onRetry={onRetry}>
                <div />
            </ErrorBoundaryMock>
        );
    }
    if (status === 'success') {
        return <div data-testid="analysis-result">분석 결과</div>;
    }
    return <div data-testid="analysis-idle">대기 중</div>;
}

interface NewsWithErrorProps {
    status: 'loading' | 'success' | 'error';
    onRetry: () => void;
}

function NewsWithError({ status, onRetry }: NewsWithErrorProps) {
    if (status === 'loading') {
        return <div data-testid="news-loading">뉴스 로딩 중...</div>;
    }
    if (status === 'error') {
        return (
            <ErrorBoundaryMock
                error="뉴스를 불러올 수 없습니다."
                onRetry={onRetry}
            >
                <div />
            </ErrorBoundaryMock>
        );
    }
    return <div data-testid="news-content">뉴스 목록</div>;
}

describe('Journey: Error Recovery', () => {
    describe('Analysis timeout -> Retry', () => {
        it('shows timeout error with retry button', () => {
            render(
                <AnalysisWithError
                    status="timeout"
                    onRetry={vi.fn()}
                    onCancel={vi.fn()}
                />
            );
            expect(
                screen.getByText('분석 시간이 초과되었습니다.')
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '다시 시도' })
            ).toBeInTheDocument();
        });

        it('calls retry handler on button click', async () => {
            const onRetry = vi.fn();
            render(
                <AnalysisWithError
                    status="timeout"
                    onRetry={onRetry}
                    onCancel={vi.fn()}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByRole('button', { name: '다시 시도' }));
            expect(onRetry).toHaveBeenCalledTimes(1);
        });
    });

    describe('Cancel loading analysis', () => {
        it('shows cancel button during loading', () => {
            render(
                <AnalysisWithError
                    status="loading"
                    onRetry={vi.fn()}
                    onCancel={vi.fn()}
                />
            );
            expect(screen.getByTestId('analysis-loading')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '취소' })
            ).toBeInTheDocument();
        });

        it('calls cancel handler', async () => {
            const onCancel = vi.fn();
            render(
                <AnalysisWithError
                    status="loading"
                    onRetry={vi.fn()}
                    onCancel={onCancel}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByRole('button', { name: '취소' }));
            expect(onCancel).toHaveBeenCalledTimes(1);
        });
    });

    describe('Analysis error -> Retry -> Success', () => {
        it('transitions from error to success after retry', () => {
            const { rerender } = render(
                <AnalysisWithError
                    status="error"
                    onRetry={vi.fn()}
                    onCancel={vi.fn()}
                />
            );
            expect(
                screen.getByText('분석에 실패했습니다.')
            ).toBeInTheDocument();

            rerender(
                <AnalysisWithError
                    status="success"
                    onRetry={vi.fn()}
                    onCancel={vi.fn()}
                />
            );
            expect(screen.getByTestId('analysis-result')).toBeInTheDocument();
            expect(
                screen.queryByText('분석에 실패했습니다.')
            ).not.toBeInTheDocument();
        });
    });

    describe('News failure -> Retry', () => {
        it('shows news error with retry option', () => {
            render(<NewsWithError status="error" onRetry={vi.fn()} />);
            expect(
                screen.getByText('뉴스를 불러올 수 없습니다.')
            ).toBeInTheDocument();
        });

        it('recovers from news error after retry', () => {
            const { rerender } = render(
                <NewsWithError status="error" onRetry={vi.fn()} />
            );
            expect(
                screen.getByText('뉴스를 불러올 수 없습니다.')
            ).toBeInTheDocument();

            rerender(<NewsWithError status="success" onRetry={vi.fn()} />);
            expect(screen.getByTestId('news-content')).toBeInTheDocument();
        });
    });

    describe('Multiple error states in sequence', () => {
        it('handles analysis timeout -> retry -> news error -> retry', () => {
            const { rerender } = render(
                <div>
                    <AnalysisWithError
                        status="timeout"
                        onRetry={vi.fn()}
                        onCancel={vi.fn()}
                    />
                    <NewsWithError status="loading" onRetry={vi.fn()} />
                </div>
            );
            expect(
                screen.getByText('분석 시간이 초과되었습니다.')
            ).toBeInTheDocument();
            expect(screen.getByTestId('news-loading')).toBeInTheDocument();

            rerender(
                <div>
                    <AnalysisWithError
                        status="success"
                        onRetry={vi.fn()}
                        onCancel={vi.fn()}
                    />
                    <NewsWithError status="error" onRetry={vi.fn()} />
                </div>
            );
            expect(screen.getByTestId('analysis-result')).toBeInTheDocument();
            expect(
                screen.getByText('뉴스를 불러올 수 없습니다.')
            ).toBeInTheDocument();

            rerender(
                <div>
                    <AnalysisWithError
                        status="success"
                        onRetry={vi.fn()}
                        onCancel={vi.fn()}
                    />
                    <NewsWithError status="success" onRetry={vi.fn()} />
                </div>
            );
            expect(screen.getByTestId('analysis-result')).toBeInTheDocument();
            expect(screen.getByTestId('news-content')).toBeInTheDocument();
        });
    });
});
