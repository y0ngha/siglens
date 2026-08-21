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
import NotFound, { generateMetadata } from '@/app/[locale]/not-found';

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

    /**
     * 제목이 로케일을 따르는지가 핵심이다. 본문이 SSR되지 않는 경계라
     * `<title>`이 크롤러와 JS 없는 사용자가 받는 전부다. ko만 검증하면
     * 정적 `metadata`(전 로케일 한국어)로 되돌려도 통과한다.
     */
    it.each([
        ['ko', '페이지를 찾을 수 없습니다'],
        ['ja', 'ページが見つかりません'],
    ])('%s: 제목이 로케일을 따르고 noindex다', async (locale, expected) => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale }),
        });
        expect(metadata.title).toBe(expected);
        expect(metadata.robots).toEqual({ index: false, follow: true });
    });
});
