vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewsError from '../error';

describe('NewsError', () => {
    it('에러 UI를 렌더한다 — role=alert + "다시 시도" 버튼 존재', () => {
        const reset = vi.fn();
        const error = new Error('polling failed');
        render(<NewsError error={error} reset={reset} />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '다시 시도' })
        ).toBeInTheDocument();
    });

    it('"다시 시도" 버튼 클릭 시 reset()이 호출된다', async () => {
        const reset = vi.fn();
        const error = new Error('polling failed');
        const user = userEvent.setup();

        render(<NewsError error={error} reset={reset} />);

        await user.click(screen.getByRole('button', { name: '다시 시도' }));
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('홈으로 링크가 렌더된다', () => {
        render(<NewsError error={new Error('e')} reset={vi.fn()} />);
        const homeLink = screen.getByRole('link', { name: /Siglens 홈으로/ });
        expect(homeLink).toHaveAttribute('href', '/');
    });
});
