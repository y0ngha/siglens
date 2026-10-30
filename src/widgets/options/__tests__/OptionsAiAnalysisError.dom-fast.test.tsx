import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from 'react-error-boundary';
import { OptionsAiAnalysisError } from '@/widgets/options/OptionsAiAnalysisError';

describe('OptionsAiAnalysisError', () => {
    it('renders error message', () => {
        render(<OptionsAiAnalysisError />);
        expect(
            screen.getByText(/옵션 분석을 가져오지 못했어요/)
        ).toBeInTheDocument();
    });

    it('renders with alert role', () => {
        render(<OptionsAiAnalysisError />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders retry button when resetErrorBoundary is provided', () => {
        render(<OptionsAiAnalysisError resetErrorBoundary={vi.fn()} />);
        expect(
            screen.getByRole('button', { name: /다시 시도/ })
        ).toBeInTheDocument();
    });

    it('does not render retry button when resetErrorBoundary is absent', () => {
        render(<OptionsAiAnalysisError />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('calls resetErrorBoundary when retry button is clicked', async () => {
        const user = userEvent.setup();
        const reset = vi.fn();
        render(<OptionsAiAnalysisError resetErrorBoundary={reset} />);
        await user.click(screen.getByRole('button', { name: /다시 시도/ }));
        expect(reset).toHaveBeenCalledTimes(1);
    });

    // 회귀: `py-1.5 text-xs`만으로는 ~28px라 44px 탭 타깃 미달이었다.
    it('retry button has a 44px tap target (min-h-11)', () => {
        render(<OptionsAiAnalysisError resetErrorBoundary={vi.fn()} />);
        expect(
            screen.getByRole('button', { name: /다시 시도/ }).className
        ).toContain('min-h-11');
    });

    describe('message prop', () => {
        it('shows the provided localized message instead of the fixed copy', () => {
            render(<OptionsAiAnalysisError message="일일 한도를 초과했어요" />);
            expect(screen.getByRole('alert')).toHaveTextContent(
                '일일 한도를 초과했어요'
            );
            expect(
                screen.queryByText(/옵션 분석을 가져오지 못했어요/)
            ).not.toBeInTheDocument();
        });

        it('falls back to the fixed copy when message is null', () => {
            render(<OptionsAiAnalysisError message={null} />);
            expect(screen.getByRole('alert')).toHaveTextContent(
                /옵션 분석을 가져오지 못했어요/
            );
        });

        it('keeps retry working alongside a message', async () => {
            const user = userEvent.setup();
            const reset = vi.fn();
            render(
                <OptionsAiAnalysisError
                    message="키가 필요해요"
                    resetErrorBoundary={reset}
                />
            );
            await user.click(screen.getByRole('button', { name: /다시 시도/ }));
            expect(reset).toHaveBeenCalledTimes(1);
        });
    });

    describe('as an ErrorBoundary FallbackComponent', () => {
        function Crash(): never {
            throw new Error('raw render crash detail');
        }

        it('shows the fixed copy and never the raw render error', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            render(
                <ErrorBoundary FallbackComponent={OptionsAiAnalysisError}>
                    <Crash />
                </ErrorBoundary>
            );
            spy.mockRestore();
            expect(screen.getByRole('alert')).toHaveTextContent(
                /옵션 분석을 가져오지 못했어요/
            );
            expect(
                screen.queryByText(/raw render crash detail/)
            ).not.toBeInTheDocument();
        });
    });
});
