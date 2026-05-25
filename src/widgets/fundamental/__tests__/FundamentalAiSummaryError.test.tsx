import { render, screen, fireEvent } from '@testing-library/react';

import { FundamentalAiSummaryError } from '../FundamentalAiSummaryError';

describe('FundamentalAiSummaryError', () => {
    it('renders the error message from an Error instance', () => {
        render(
            <FundamentalAiSummaryError
                error={new Error('네트워크 오류')}
                resetErrorBoundary={vi.fn()}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('네트워크 오류');
    });

    it('renders a fallback message for non-Error values', () => {
        render(
            <FundamentalAiSummaryError
                error="string error"
                resetErrorBoundary={vi.fn()}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent(
            '분석 중 오류가 발생했습니다.'
        );
    });

    it('renders the heading', () => {
        render(
            <FundamentalAiSummaryError
                error={new Error('err')}
                resetErrorBoundary={vi.fn()}
            />
        );

        expect(
            screen.getByRole('heading', { name: /AI 펀더멘털 분석/ })
        ).toBeInTheDocument();
    });

    it('calls resetErrorBoundary when retry button is clicked', () => {
        const handleRetry = vi.fn();
        render(
            <FundamentalAiSummaryError
                error={new Error('err')}
                resetErrorBoundary={handleRetry}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }));

        expect(handleRetry).toHaveBeenCalledTimes(1);
    });
});
