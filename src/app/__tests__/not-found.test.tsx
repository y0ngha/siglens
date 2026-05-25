vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
}));
vi.mock('@/widgets/layout/ContactDialog', () => ({
    ContactDialog: () => <div data-testid="contact-dialog" />,
}));
vi.mock('@/widgets/home/TickerCategories', () => ({
    TickerCategories: () => <div data-testid="ticker-categories" />,
}));
vi.mock('next/link', () => ({
    default: ({
        children,
        href,
    }: {
        children: React.ReactNode;
        href: string;
    }) => <a href={href}>{children}</a>,
}));

import { render, screen } from '@testing-library/react';
import NotFound, { metadata } from '@/app/not-found';

describe('NotFound page', () => {
    it('renders the 404 text', () => {
        render(<NotFound />);

        expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('renders the main heading', () => {
        render(<NotFound />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '페이지를 찾을 수 없습니다'
        );
    });

    it('renders a link back to home', () => {
        render(<NotFound />);

        const link = screen.getByRole('link', {
            name: /홈으로 돌아가기/,
        });
        expect(link).toHaveAttribute('href', '/');
    });

    it('renders the contact dialog trigger', () => {
        render(<NotFound />);

        expect(screen.getByTestId('contact-dialog')).toBeInTheDocument();
    });

    it('renders TickerCategories', () => {
        render(<NotFound />);

        expect(screen.getByTestId('ticker-categories')).toBeInTheDocument();
    });

    it('exports metadata with noindex', () => {
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false })
        );
    });
});
