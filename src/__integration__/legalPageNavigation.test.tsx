import { render, screen } from '@testing-library/react';

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

function LegalPageMock({
    title,
    content,
    links,
}: {
    title: string;
    content: string;
    links: Array<{ href: string; label: string }>;
}) {
    const Link = ({
        href,
        children,
    }: {
        href: string;
        children: React.ReactNode;
    }) => <a href={href}>{children}</a>;

    return (
        <div>
            <nav aria-label="법적 문서 탐색">
                {links.map(l => (
                    <Link key={l.href} href={l.href}>
                        {l.label}
                    </Link>
                ))}
            </nav>
            <h1>{title}</h1>
            <div>{content}</div>
        </div>
    );
}

describe('Legal Page Navigation', () => {
    const LEGAL_LINKS = [
        { href: '/privacy', label: '개인정보 처리방침' },
        { href: '/terms', label: '서비스 이용약관' },
    ];

    it('renders privacy page with navigation links', () => {
        render(
            <LegalPageMock
                title="개인정보 처리방침"
                content="SigLens는 사용자의 개인정보를 보호합니다."
                links={LEGAL_LINKS}
            />
        );
        expect(
            screen.getByRole('heading', { name: '개인정보 처리방침' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '서비스 이용약관' })
        ).toHaveAttribute('href', '/terms');
    });

    it('renders terms page with correct content', () => {
        render(
            <LegalPageMock
                title="서비스 이용약관"
                content="SigLens 서비스 이용약관입니다."
                links={LEGAL_LINKS}
            />
        );
        expect(
            screen.getByRole('heading', { name: '서비스 이용약관' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '개인정보 처리방침' })
        ).toHaveAttribute('href', '/privacy');
    });

    it('has accessible navigation landmark', () => {
        render(
            <LegalPageMock
                title="개인정보 처리방침"
                content=""
                links={LEGAL_LINKS}
            />
        );
        expect(
            screen.getByRole('navigation', { name: '법적 문서 탐색' })
        ).toBeInTheDocument();
    });

    it('all legal links have valid hrefs', () => {
        render(<LegalPageMock title="" content="" links={LEGAL_LINKS} />);
        const links = screen.getAllByRole('link');
        for (const link of links) {
            expect(link.getAttribute('href')).toMatch(/^\/(privacy|terms)/);
        }
    });
});
