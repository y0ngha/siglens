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

    /**
     * 404가 저장된 테마를 실제로 적용하는지 본다.
     *
     * 왜 결과를 재는가: 동적 세그먼트의 `notFound()`는 루트 레이아웃 없는
     * 에러 셸로 렌더되고 그 `<head>`에는 테마 스크립트가 없다 — 이 페이지가
     * 직접 찍지 않으면 라이트를 고른 사용자가 어두운 404를 본다. 감사가
     * `<ThemeAttributeFallback />`을 지우고 전체 스위트를 돌렸을 때 10,474건이
     * 전부 초록이었다. 이 브랜치의 간판 수정이 아무 신호 없이 삭제 가능했다.
     *
     * 컴포넌트가 트리에 있는지가 아니라 **속성이 찍혔는지**를 단언한다.
     * 존재만 보면 그 컴포넌트가 아무것도 안 하게 되어도 통과한다.
     */
    it('저장된 테마를 <html>에 적용한다', () => {
        localStorage.setItem('siglens-theme', 'light');
        document.documentElement.removeAttribute('data-theme');

        render(<NotFound />);

        expect(document.documentElement.getAttribute('data-theme')).toBe(
            'light'
        );
    });
});
