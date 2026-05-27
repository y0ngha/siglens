import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartErrorFallback } from '@/widgets/chart/ChartErrorFallback';
import { FMP_TEMPORARY_UNAVAILABLE_MESSAGE } from '@/shared/api/fmp/fmpUserMessage';

describe('ChartErrorFallback 컴포넌트는', () => {
    describe('에러 메시지 표시에서', () => {
        it('Error 인스턴스의 메시지를 표시한다', () => {
            const error = new Error('차트 로딩 실패');
            render(
                <ChartErrorFallback
                    error={error}
                    resetErrorBoundary={vi.fn()}
                />
            );

            expect(screen.getByText('차트 로딩 실패')).toBeInTheDocument();
        });

        it('Error가 아닌 값에는 기본 메시지를 표시한다', () => {
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

        it('FMP 요청이 끝내 실패하면 데이터 서버 안내 문구를 표시한다', () => {
            render(
                <ChartErrorFallback
                    error={new Error('FMP API error: 429 Too Many Requests')}
                    resetErrorBoundary={vi.fn()}
                />
            );

            expect(
                screen.getByText(FMP_TEMPORARY_UNAVAILABLE_MESSAGE)
            ).toBeInTheDocument();
        });
    });

    describe('다시 시도 버튼은', () => {
        it('버튼을 표시한다', () => {
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

        it('클릭하면 resetErrorBoundary를 호출한다', async () => {
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
});
