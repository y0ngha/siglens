import { render, screen } from '@testing-library/react';
import { LegalBreadcrumb } from '@/widgets/legal/LegalBreadcrumb';
import messages from '../../messages/ko.json';

// 브레드크럼 랜드마크 이름은 `shared.ui.Breadcrumb` 카탈로그 값이다 — 리터럴로
// 두면 번역 한 줄에 통합 테스트가 깨진다(LegalBreadcrumb.test.tsx와 같은 방식).
const NAV_LABEL = messages.shared.ui.Breadcrumb['46c31f'];

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
                screen.getByRole('navigation', { name: NAV_LABEL })
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
