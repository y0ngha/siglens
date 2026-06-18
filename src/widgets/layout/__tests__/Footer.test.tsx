vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('../ContactDialog', () => ({
    ContactDialog: ({ triggerLabel }: { triggerLabel: string }) => (
        <button type="button">{triggerLabel}</button>
    ),
}));
vi.mock('../CurrentYear', () => ({
    CurrentYear: () => <>2026</>,
}));
vi.mock('@/shared/ui/DotSeparator', () => ({
    DotSeparator: () => <span aria-hidden="true">·</span>,
}));
vi.mock('@/shared/lib/legal', () => ({
    INVESTMENT_DISCLAIMER: '투자 면책 고지 텍스트',
    PRIVACY_PATH: '/privacy',
    PRIVACY_TITLE: '개인정보처리방침',
    TERMS_PATH: '/terms',
    TERMS_TITLE: '이용약관',
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { Footer } from '../Footer';

describe('Footer', () => {
    it('renders the investment disclaimer', () => {
        render(<Footer />);

        expect(screen.getByText('투자 면책 고지 텍스트')).toBeInTheDocument();
    });

    it('renders the copyright with year', () => {
        render(<Footer />);

        expect(screen.getByText(/© 2026 Siglens/)).toBeInTheDocument();
    });

    it('renders the privacy policy link', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /개인정보처리방침/ });
        expect(link).toHaveAttribute('href', '/privacy');
    });

    it('renders the terms link', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /이용약관/ });
        expect(link).toHaveAttribute('href', '/terms');
    });

    it('renders the contact dialog trigger', () => {
        render(<Footer />);

        expect(
            screen.getByRole('button', { name: /문의하기/ })
        ).toBeInTheDocument();
    });

    it('has a navigation landmark for site info', () => {
        render(<Footer />);

        expect(
            screen.getByRole('navigation', { name: /사이트 정보/ })
        ).toBeInTheDocument();
    });

    it('renders the /economy link with 미국 경제 label', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /미국 경제/ });
        expect(link).toHaveAttribute('href', '/economy');
    });

    it('renders the /news link with 마켓 뉴스 label', () => {
        render(<Footer />);

        const link = screen.getByRole('link', { name: /마켓 뉴스/ });
        expect(link).toHaveAttribute('href', '/news');
    });
});
