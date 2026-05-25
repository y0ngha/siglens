import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartErrorFallback } from '@/widgets/chart/ChartErrorFallback';

describe('ChartErrorFallback', () => {
    it('renders the error message from an Error instance', () => {
        const error = new Error('차트 로딩 실패');
        render(
            <ChartErrorFallback error={error} resetErrorBoundary={vi.fn()} />
        );

        expect(screen.getByText('차트 로딩 실패')).toBeInTheDocument();
    });

    it('renders a fallback message for non-Error values', () => {
        render(
            <ChartErrorFallback
                error="string error"
                resetErrorBoundary={vi.fn()}
            />
        );

        expect(
            screen.getByText('알 수 없는 오류가 발생했습니다.')
        ).toBeInTheDocument();
    });

    it('renders the retry button', () => {
        render(
            <ChartErrorFallback
                error={new Error('test')}
                resetErrorBoundary={vi.fn()}
            />
        );

        expect(
            screen.getByRole('button', { name: '다시 시도' })
        ).toBeInTheDocument();
    });

    it('calls resetErrorBoundary when retry button is clicked', async () => {
        const user = userEvent.setup();
        const resetErrorBoundary = vi.fn();
        render(
            <ChartErrorFallback
                error={new Error('test')}
                resetErrorBoundary={resetErrorBoundary}
            />
        );

        await user.click(screen.getByRole('button', { name: '다시 시도' }));

        expect(resetErrorBoundary).toHaveBeenCalledTimes(1);
    });
});
