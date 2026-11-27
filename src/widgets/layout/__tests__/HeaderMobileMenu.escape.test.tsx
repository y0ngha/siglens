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
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));
vi.mock('@/shared/i18n/navigation', () => ({
    usePathname: () => '/market',
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import { fireEvent, screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { HeaderMobileMenu } from '../HeaderMobileMenu';
import { NAV_TREE } from '../utils/headerNavTree';

/** 닫힌 드로어는 DOM에 남되 `inert`다 — 접근성 트리·탭 순서에서 모두 빠진다. */
function expectDrawerClosed() {
    expect(document.getElementById('mobile-nav-drawer')).toHaveAttribute(
        'inert'
    );
}

/**
 * 드로어에는 Escape 레이어가 하나뿐이다 — 언어·테마의 집은 헤더 계정 영역(文A·◐ 버튼 / 아바타
 * 메뉴)이고, 폰 폭 비회원에게 드로어가 보이는 테마는 팝오버가 아니라 인라인 라디오그룹이다.
 * Escape 한 번에 드로어가 닫혀야 한다.
 */
describe('HeaderMobileMenu Escape', () => {
    const openDrawer = () =>
        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

    it('회원(인증 CTA 없음) 드로어에는 언어·테마 컨트롤이 없다 — 아바타 메뉴에 있다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} />);
        openDrawer();

        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    /** 폰 폭 비회원은 헤더 줄의 ◐ 자리가 없어 드로어에서 테마를 고른다. 언어는 헤더 文A에 남는다. */
    it('비회원 드로어에는 폰 폭에서만 보이는 인라인 테마 그룹이 있다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} showAuthCta />);
        openDrawer();

        const theme = screen.getByRole('radiogroup', { name: '테마' });
        expect(theme.closest('.min-\\[30rem\\]\\:hidden')).not.toBeNull();
        expect(
            screen.queryByRole('radiogroup', { name: '언어' })
        ).not.toBeInTheDocument();
    });

    it('테마를 고른 뒤 Escape 한 번에 드로어가 닫힌다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} showAuthCta />);
        openDrawer();
        fireEvent.click(screen.getByRole('radio', { name: /다크/ }));

        fireEvent.keyDown(document, { key: 'Escape' });

        expectDrawerClosed();
        localStorage.clear();
    });

    it('Escape 한 번에 드로어가 닫힌다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} />);
        openDrawer();

        fireEvent.keyDown(document, { key: 'Escape' });

        expectDrawerClosed();
    });
});
