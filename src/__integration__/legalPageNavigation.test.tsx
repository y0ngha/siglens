import { render, screen } from '@testing-library/react';
import { LegalBreadcrumb } from '@/widgets/legal/LegalBreadcrumb';
import { PolicySection } from '@/widgets/legal/PolicySection';

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

    describe('PolicySection', () => {
        it('renders section with id and title', () => {
            render(
                <PolicySection id="data-collection" title="개인정보 수집">
                    <p>수집 항목에 대한 설명입니다.</p>
                </PolicySection>
            );
            expect(
                screen.getByRole('heading', { name: '개인정보 수집' })
            ).toBeInTheDocument();
        });

        it('renders children content', () => {
            render(
                <PolicySection id="usage" title="개인정보 이용">
                    <p>이용 목적 설명</p>
                </PolicySection>
            );
            expect(screen.getByText('이용 목적 설명')).toBeInTheDocument();
        });

        it('has correct id attribute for anchor navigation', () => {
            const { container } = render(
                <PolicySection id="retention" title="보유기간">
                    <p>보유기간 설명</p>
                </PolicySection>
            );
            const section = container.querySelector('#retention');
            expect(section).toBeTruthy();
        });
    });
});
