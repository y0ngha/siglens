import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
