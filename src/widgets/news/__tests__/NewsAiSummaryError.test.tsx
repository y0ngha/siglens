import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsAiSummaryError } from '@/widgets/news/NewsAiSummaryError';
import { FMP_TEMPORARY_UNAVAILABLE_MESSAGE } from '@/shared/api/fmp/fmpUserMessage';

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

    it('FMP 형태 에러여도 FMP 안내 문구가 아닌 원본 error.message를 표시한다 (뉴스 서피스 동작 보존)', () => {
        render(
            <NewsAiSummaryError
                error={new Error('FMP profile 429')}
                resetErrorBoundary={vi.fn()}
            />
        );
        expect(screen.getByText('FMP profile 429')).toBeInTheDocument();
        expect(
            screen.queryByText(FMP_TEMPORARY_UNAVAILABLE_MESSAGE)
        ).not.toBeInTheDocument();
    });
});
