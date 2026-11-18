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
import { HeaderMobileMenu } from '../HeaderMobileMenu';
import { NAV_TREE } from '../utils/headerNavTree';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

/** 닫힌 드로어는 DOM에 남되 `inert`다 — 접근성 트리·탭 순서에서 모두 빠진다. */
function expectDrawerClosed() {
    expect(document.getElementById('mobile-nav-drawer')).toHaveAttribute(
        'inert'
    );
}

/**
 * 드로어에는 Escape 레이어가 하나뿐이다 — 언어·테마는 헤더 계정 영역(文A 버튼 / 아바타 메뉴)으로
 * 옮겨 드로어 안에 팝오버가 없다. Escape 한 번에 드로어가 닫혀야 한다.
 */
describe('HeaderMobileMenu Escape', () => {
    const openDrawer = () =>
        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

    it('드로어 안에 언어·테마 컨트롤이 없다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} />);
        openDrawer();

        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /언어|테마/ })
        ).not.toBeInTheDocument();
    });

    it('Escape 한 번에 드로어가 닫힌다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} />);
        openDrawer();

        fireEvent.keyDown(document, { key: 'Escape' });

        expectDrawerClosed();
    });
});
