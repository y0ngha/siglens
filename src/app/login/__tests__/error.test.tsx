vi.mock('next/link', () => ({
    default: ({
        children,
        href,
    }: {
        children: React.ReactNode;
        href: string;
    }) => <a href={href}>{children}</a>,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import LoginError from '@/app/login/error';

describe('LoginError page', () => {
    it('renders the error heading', () => {
        render(
            <LoginError
                error={Object.assign(new Error('test'), { digest: 'abc' })}
                reset={vi.fn()}
            />
        );

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '로그인 페이지를 표시할 수 없어요'
        );
    });

    it('renders a retry button that calls reset', () => {
        const mockReset = vi.fn();
        render(
            <LoginError
                error={Object.assign(new Error('test'), { digest: 'abc' })}
                reset={mockReset}
            />
        );

        const retryButton = screen.getByRole('button', { name: '다시 시도' });
        fireEvent.click(retryButton);

        expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('renders a link to the home page', () => {
        render(
            <LoginError
                error={Object.assign(new Error('test'), { digest: 'abc' })}
                reset={vi.fn()}
            />
        );

        const homeLink = screen.getByRole('link', { name: '홈으로' });
        expect(homeLink).toHaveAttribute('href', '/');
    });
});
