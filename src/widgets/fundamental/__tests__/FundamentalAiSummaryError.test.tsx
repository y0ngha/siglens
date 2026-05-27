import { render, screen, fireEvent } from '@testing-library/react';

import { FundamentalAiSummaryError } from '../FundamentalAiSummaryError';
import { FMP_TEMPORARY_UNAVAILABLE_MESSAGE } from '@/shared/api/fmp/fmpUserMessage';

describe('FundamentalAiSummaryError 컴포넌트는', () => {
    describe('에러 메시지 표시에서', () => {
        it('Error 인스턴스의 메시지를 표시한다', () => {
            render(
                <FundamentalAiSummaryError
                    error={new Error('네트워크 오류')}
                    resetErrorBoundary={vi.fn()}
                />
            );

            expect(screen.getByRole('alert')).toHaveTextContent(
                '네트워크 오류'
            );
        });

        it('Error가 아닌 값에는 기본 메시지를 표시한다', () => {
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

        it('FMP 요청이 끝내 실패하면 데이터 서버 안내 문구를 표시한다', () => {
            render(
                <FundamentalAiSummaryError
                    error={new Error('FMP profile 429')}
                    resetErrorBoundary={vi.fn()}
                />
            );

            expect(screen.getByRole('alert')).toHaveTextContent(
                FMP_TEMPORARY_UNAVAILABLE_MESSAGE
            );
        });

        it('제목을 표시한다', () => {
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
    });

    describe('다시 시도 버튼은', () => {
        it('클릭하면 resetErrorBoundary를 호출한다', () => {
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
});
