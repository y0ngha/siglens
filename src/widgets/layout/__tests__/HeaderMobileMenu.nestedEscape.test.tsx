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
 * 드로어 안의 언어 팝오버는 드로어와 별개의 Escape 레이어다. 한 번의 Escape가 둘을 한꺼번에
 * 닫으면 사용자는 팝오버만 닫으려다 내비게이션 맥락을 잃는다.
 */
describe('HeaderMobileMenu 중첩 Escape', () => {
    const openDrawer = () =>
        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const openLocalePopover = () =>
        fireEvent.click(screen.getByRole('button', { name: /언어/ }));

    it('언어 팝오버가 열려 있으면 첫 Escape는 팝오버만 닫는다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} />);
        openDrawer();
        openLocalePopover();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('두 번째 Escape가 드로어를 닫는다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} />);
        openDrawer();
        openLocalePopover();

        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.keyDown(document, { key: 'Escape' });

        expectDrawerClosed();
    });

    it('팝오버가 닫혀 있으면 Escape 한 번에 드로어가 닫힌다', () => {
        renderWithIntl(<HeaderMobileMenu items={NAV_TREE} />);
        openDrawer();

        fireEvent.keyDown(document, { key: 'Escape' });

        expectDrawerClosed();
    });
});
