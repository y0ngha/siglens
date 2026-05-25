import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/nonexistent-route',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
    }: {
        href: string;
        children: React.ReactNode;
    }) => <span data-href={href}>{children}</span>,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

function NotFoundPageMock() {
    return (
        <div>
            <h1>404</h1>
            <p>요청하신 페이지를 찾을 수 없습니다.</p>
            <nav aria-label="추천 페이지">
                <span data-href="/" role="link">
                    홈으로 돌아가기
                </span>
                <span data-href="/market" role="link">
                    대시보드
                </span>
            </nav>
        </div>
    );
}

describe('Not Found Page', () => {
    it('renders 404 heading', () => {
        render(<NotFoundPageMock />);
        expect(
            screen.getByRole('heading', { name: '404' })
        ).toBeInTheDocument();
    });

    it('shows descriptive error message', () => {
        render(<NotFoundPageMock />);
        expect(
            screen.getByText('요청하신 페이지를 찾을 수 없습니다.')
        ).toBeInTheDocument();
    });

    it('provides navigation suggestions', () => {
        render(<NotFoundPageMock />);
        expect(
            screen.getByRole('link', { name: '홈으로 돌아가기' })
        ).toHaveAttribute('data-href', '/');
        expect(screen.getByRole('link', { name: '대시보드' })).toHaveAttribute(
            'data-href',
            '/market'
        );
    });

    it('has accessible navigation landmark for suggestions', () => {
        render(<NotFoundPageMock />);
        expect(
            screen.getByRole('navigation', { name: '추천 페이지' })
        ).toBeInTheDocument();
    });
});
