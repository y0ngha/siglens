import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FearGreedPageError } from '../FearGreedPageError';

describe('FearGreedPageError', () => {
    it('기술적 에러 메시지 대신 고정 한국어 안내를 표시한다', () => {
        const error = new Error('FMP news/stock 429');
        render(
            <FearGreedPageError error={error} resetErrorBoundary={vi.fn()} />
        );
        expect(
            screen.getByText(
                '공포 탐욕 지수를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
            )
        ).toBeInTheDocument();
    });

    it('has accessible alert role', () => {
        render(
            <FearGreedPageError
                error={new Error('test')}
                resetErrorBoundary={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('다시 시도 버튼 클릭 시 resetErrorBoundary를 호출한다', async () => {
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
