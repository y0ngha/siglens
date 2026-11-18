const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));
// 언어·테마 섹션(`PreferencesSection`)이 로케일 라우터를 쓴다 — 테스트에는 앱 라우터가 없다.
vi.mock('@/shared/i18n/navigation', () => ({
    usePathname: () => '/market',
    useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));
vi.mock('@/features/auth-logout/ui/LogoutButton', () => ({
    LogoutButton: () => <button>로그아웃</button>,
}));

import { fireEvent, render, screen, within } from '@testing-library/react';
import { UserMenuPanel } from '../../../ui/user-menu/UserMenuPanel';

const user = {
    email: 'user@example.com',
    name: 'Yongha',
    tier: 'pro' as const,
    avatarUrl: null,
};

describe('UserMenuPanel', () => {
    it('이름이 있으면 이름과 이메일을 둘 다 보인다', () => {
        render(<UserMenuPanel id="p" user={user} onNavigate={vi.fn()} />);

        expect(screen.getByText('Yongha')).toBeInTheDocument();
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });

    it('이름이 없으면 이메일을 제목으로 한 번만 보인다', () => {
        render(
            <UserMenuPanel
                id="p"
                user={{ ...user, name: null }}
                onNavigate={vi.fn()}
            />
        );

        expect(screen.getAllByText('user@example.com')).toHaveLength(1);
    });

    it('이동 링크를 평범한 목록으로 그리고, 로그아웃은 목록 밖 맨 끝에 둔다', () => {
        render(<UserMenuPanel id="p" user={user} onNavigate={vi.fn()} />);

        const list = screen.getByRole('list', { name: '사용자 메뉴' });
        const items = within(list).getAllByRole('listitem');
        expect(items).toHaveLength(3);
        expect(
            within(list)
                .getAllByRole('link')
                .map(a => a.getAttribute('href'))
        ).toEqual(['/portfolio', '/email-report', '/account']);
        expect(
            within(list).queryByRole('button', { name: '로그아웃' })
        ).not.toBeInTheDocument();
        const buttons = screen.getAllByRole('button');
        expect(buttons.at(-1)).toHaveAccessibleName('로그아웃');
    });

    it('메뉴 역할을 쓰지 않는다', () => {
        render(<UserMenuPanel id="p" user={user} onNavigate={vi.fn()} />);

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    });

    /**
     * 언어·테마는 "아이콘 · 이름 · 현재 값" 두 줄이다. 선택지를 늘 펼쳐 두면 메뉴가 두 배로 길어져
     * 계정 링크·로그아웃을 밀어내므로, 처음에는 접혀 있다.
     */
    it('언어·테마는 현재 값을 보이는 접힌 두 줄이다', () => {
        render(<UserMenuPanel id="p" user={user} onNavigate={vi.fn()} />);

        const language = screen.getByRole('button', { name: /^언어/ });
        const theme = screen.getByRole('button', { name: /^테마/ });
        expect(language).toHaveTextContent('한국어');
        expect(theme).toHaveTextContent('시스템 설정');
        for (const row of [language, theme]) {
            expect(row).toHaveAttribute('aria-expanded', 'false');
            expect(row).not.toHaveAttribute('aria-controls');
        }
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('줄을 누르면 그 아래에 선택지가 펼쳐지고, 한 번에 한 줄만 열린다', () => {
        render(<UserMenuPanel id="p" user={user} onNavigate={vi.fn()} />);
        const language = screen.getByRole('button', { name: /^언어/ });
        const theme = screen.getByRole('button', { name: /^테마/ });

        fireEvent.click(language);
        expect(language).toHaveAttribute('aria-expanded', 'true');
        const languageGroup = screen.getByRole('radiogroup');
        expect(language).toHaveAttribute(
            'aria-controls',
            languageGroup.parentElement?.id
        );
        expect(languageGroup).toHaveAccessibleName(/^언어/);

        fireEvent.click(theme);
        expect(language).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
        expect(screen.getByRole('radiogroup')).toHaveAccessibleName(/^테마/);

        fireEvent.click(theme);
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('언어를 고르면 그 로케일로 이동하고 패널을 닫는다', () => {
        mockReplace.mockClear();
        const onNavigate = vi.fn();
        render(<UserMenuPanel id="p" user={user} onNavigate={onNavigate} />);

        fireEvent.click(screen.getByRole('button', { name: /^언어/ }));
        fireEvent.click(screen.getByRole('radio', { name: 'English' }));

        expect(mockReplace).toHaveBeenCalledWith('/market', { locale: 'en' });
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('테마를 고르면 줄의 현재 값이 바뀌고 메뉴는 닫지 않는다', () => {
        localStorage.clear();
        const onNavigate = vi.fn();
        render(<UserMenuPanel id="p" user={user} onNavigate={onNavigate} />);

        fireEvent.click(screen.getByRole('button', { name: /^테마/ }));
        fireEvent.click(screen.getByRole('radio', { name: /라이트/ }));

        expect(screen.getByRole('button', { name: /^테마/ })).toHaveTextContent(
            '라이트'
        );
        expect(onNavigate).not.toHaveBeenCalled();
        localStorage.clear();
    });

    it('링크를 누르면 onNavigate를 부른다', () => {
        const onNavigate = vi.fn();
        render(<UserMenuPanel id="p" user={user} onNavigate={onNavigate} />);

        fireEvent.click(screen.getByRole('link', { name: '계정 설정' }));

        expect(onNavigate).toHaveBeenCalledTimes(1);
    });
});
