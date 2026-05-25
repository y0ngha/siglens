import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsAiSummaryError } from '@/widgets/news/NewsAiSummaryError';

describe('NewsAiSummaryError', () => {
    it('renders error message from Error object', () => {
        render(
            <NewsAiSummaryError
                error={new Error('뉴스 분석 실패')}
                resetErrorBoundary={vi.fn()}
            />
        );
        expect(screen.getByText('뉴스 분석 실패')).toBeInTheDocument();
    });

    it('renders default message for non-Error objects', () => {
        render(
            <NewsAiSummaryError
                error={'string error' as unknown as Error}
                resetErrorBoundary={vi.fn()}
            />
        );
        expect(
            screen.getByText('분석 중 오류가 발생했습니다.')
        ).toBeInTheDocument();
    });

    it('renders heading', () => {
        render(
            <NewsAiSummaryError
                error={new Error('test')}
                resetErrorBoundary={vi.fn()}
            />
        );
        expect(
            screen.getByRole('heading', { name: /AI 뉴스 종합 분석/ })
        ).toBeInTheDocument();
    });

    it('renders alert role for the error message', () => {
        render(
            <NewsAiSummaryError
                error={new Error('test')}
                resetErrorBoundary={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('calls resetErrorBoundary when retry button is clicked', async () => {
        const user = userEvent.setup();
        const reset = vi.fn();
        render(
            <NewsAiSummaryError
                error={new Error('test')}
                resetErrorBoundary={reset}
            />
        );
        await user.click(screen.getByRole('button', { name: /다시 시도/ }));
        expect(reset).toHaveBeenCalledTimes(1);
    });
});
