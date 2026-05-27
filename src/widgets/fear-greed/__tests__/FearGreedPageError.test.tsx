import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FearGreedPageError } from '../FearGreedPageError';
import { FMP_TEMPORARY_UNAVAILABLE_MESSAGE } from '@/shared/api/fmp/fmpUserMessage';

describe('FearGreedPageError 컴포넌트는', () => {
    describe('에러 메시지 표시에서', () => {
        it('일반 오류에는 고정 한국어 안내를 표시한다', () => {
            const error = new Error('boom');
            render(
                <FearGreedPageError
                    error={error}
                    resetErrorBoundary={vi.fn()}
                />
            );
            expect(
                screen.getByText(
                    '공포 탐욕 지수를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                )
            ).toBeInTheDocument();
        });

        it('FMP 요청이 끝내 실패하면 데이터 서버 안내 문구를 표시한다', () => {
            render(
                <FearGreedPageError
                    error={new Error('FMP API error: 429 Too Many Requests')}
                    resetErrorBoundary={vi.fn()}
                />
            );

            expect(
                screen.getByText(FMP_TEMPORARY_UNAVAILABLE_MESSAGE)
            ).toBeInTheDocument();
        });

        it('alert 역할을 가진다', () => {
            render(
                <FearGreedPageError
                    error={new Error('test')}
                    resetErrorBoundary={vi.fn()}
                />
            );
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    describe('다시 시도 버튼은', () => {
        it('클릭하면 resetErrorBoundary를 호출한다', async () => {
            const resetFn = vi.fn();
            render(
                <FearGreedPageError
                    error={new Error('test')}
                    resetErrorBoundary={resetFn}
                />
            );
            const user = userEvent.setup();
            await user.click(screen.getByRole('button', { name: '다시 시도' }));
            expect(resetFn).toHaveBeenCalledTimes(1);
        });
    });
});
