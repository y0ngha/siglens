import { render, screen } from '@testing-library/react';
import { LegalBreadcrumb } from '@/widgets/legal/LegalBreadcrumb';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/privacy',
    useSearchParams: () => new URLSearchParams(),
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

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

describe('Legal Page Navigation', () => {
    describe('LegalBreadcrumb', () => {
        it('renders breadcrumb with page title', () => {
            render(<LegalBreadcrumb pageTitle="개인정보 처리방침" />);
            expect(screen.getByText('개인정보 처리방침')).toBeInTheDocument();
        });

        it('has accessible breadcrumb navigation landmark', () => {
            render(<LegalBreadcrumb pageTitle="개인정보 처리방침" />);
            expect(
                screen.getByRole('navigation', { name: 'breadcrumb' })
            ).toBeInTheDocument();
        });

        it('renders link to home page with site name', () => {
            render(<LegalBreadcrumb pageTitle="서비스 이용약관" />);
            const homeLink = screen.getByRole('link');
            expect(homeLink).toHaveAttribute('href', '/');
        });

        it('marks current page with aria-current', () => {
            render(<LegalBreadcrumb pageTitle="개인정보 처리방침" />);
            const currentItem = screen.getByText('개인정보 처리방침');
            expect(currentItem.closest('[aria-current="page"]')).toBeTruthy();
        });
    });
});
