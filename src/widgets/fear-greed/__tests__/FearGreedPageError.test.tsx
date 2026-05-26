import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FearGreedPageError } from '../FearGreedPageError';

describe('FearGreedPageError', () => {
    it('renders error message from Error instance', () => {
        const error = new Error('공포 탐욕 지수 데이터를 불러올 수 없습니다.');
        render(
            <FearGreedPageError error={error} resetErrorBoundary={vi.fn()} />
        );
        expect(
            screen.getByText('공포 탐욕 지수 데이터를 불러올 수 없습니다.')
        ).toBeInTheDocument();
    });

    it('renders default message for non-Error values', () => {
        render(
            <FearGreedPageError
                error="string error"
                resetErrorBoundary={vi.fn()}
            />
        );
        expect(
            screen.getByText(
                '공포 탐욕 지수를 불러오는 중 오류가 발생했습니다.'
            )
        ).toBeInTheDocument();
    });

    it('has accessible alert role', () => {
        const error = new Error('오류');
        render(
            <FearGreedPageError error={error} resetErrorBoundary={vi.fn()} />
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders retry button that calls resetErrorBoundary', async () => {
        const resetFn = vi.fn();
        const error = new Error('오류');
        render(
            <FearGreedPageError error={error} resetErrorBoundary={resetFn} />
        );
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(resetFn).toHaveBeenCalledTimes(1);
    });
});
