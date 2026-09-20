vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
}));
vi.mock('@/widgets/layout/ContactDialog', () => ({
    ContactDialog: () => <div data-testid="contact-dialog" />,
}));
vi.mock('@/features/ticker-search', () => ({
    SymbolSearchPanel: () => <div data-testid="symbol-search-panel" />,
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

const { mockPathname } = vi.hoisted(() => ({
    mockPathname: vi.fn(() => '/nope'),
}));
vi.mock('next/navigation', () => ({ usePathname: mockPathname }));

import { render, screen } from '@testing-library/react';
import NotFound, { generateMetadata } from '@/app/[locale]/not-found';

describe('NotFound page', () => {
    beforeEach(() => {
        mockPathname.mockReturnValue('/nope');
    });

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

    /**
     * 회귀 가드(2026-09 구글 정책 감사 L19): 여기에 `TickerCategories`가 있어
     * 404 한 장이 링크 85개를 내보냈다 — 크롤러에게는 404가 허브처럼 보였다.
     * 검색 진입 + 허브 링크 둘만 남는다.
     */
    it('카테고리 그리드 대신 검색 진입과 허브 링크 둘만 둔다', () => {
        render(<NotFound />);

        expect(screen.getByTestId('symbol-search-panel')).toBeInTheDocument();
        const hrefs = screen
            .getAllByRole('link')
            .map(link => link.getAttribute('href'));
        expect(hrefs).toEqual(['/', '/market', '/news']);
    });

    /**
     * 만료된 공유 링크는 `share/[id]/page.tsx`가 `notFound()`로 보낸다(전에는
     * 200이라 soft-404였다). 상태 코드만 고치고 문구를 잃으면 공유 링크를 눌러 온
     * 사람이 "주소가 바뀌었다"는 틀린 설명을 본다.
     */
    it('/share/ 경로에서는 만료 안내 문구를 보여준다', () => {
        mockPathname.mockReturnValue('/ja/share/abc123');
        render(<NotFound />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '이 공유 링크는 만료됐어요'
        );
        expect(screen.getByText('공유 링크 만료')).toBeInTheDocument();
        expect(screen.queryByText('404')).not.toBeInTheDocument();
    });

    /**
     * 제목이 로케일을 따르는지가 핵심이다. 본문이 SSR되지 않는(아래 참고) 이
     * 경계에서는 `<title>`이 크롤러와 JS 없는 사용자가 받는 전부다. ko만 검증하면
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

    /**
     * 회귀 가드(2026-09-20 네이버 "동일 설명문" 감지): `description`을 빼면 Next가
     * 루트 레이아웃(홈) 설명문을 상속시켜, 존재하지 않는 **모든** URL이 홈과 똑같은
     * `<meta name="description">`을 달고 나간다. 404 URL은 수에 상한이 없다.
     */
    it.each([
        ['ko', '요청하신 페이지가 존재하지 않거나'],
        ['ja', 'お探しのページは存在しないか'],
    ])(
        '%s: 설명문이 로케일을 따르고 홈 설명을 상속하지 않는다',
        async (locale, expected) => {
            const metadata = await generateMetadata({
                params: Promise.resolve({ locale }),
            });

            expect(metadata.description).toContain(expected);
            // JSX 들여쓰기에서 온 줄바꿈·연속 공백이 메타 태그에 실리면 안 된다.
            expect(metadata.description).not.toMatch(/\s{2,}|\n/u);
        }
    );

    /*
     * 테마 적용은 `ContactDialog`가 한다(그 파일의 주석 참고 — 전용 컴포넌트를
     * 두면 홈 first-load가 17.3KB 늘어난다). 여기서는 그 컴포넌트가 렌더되는지만
     * 보고, 실제 속성이 찍히는지는 `ContactDialog.test.tsx`와 e2e가 본다.
     */
});
