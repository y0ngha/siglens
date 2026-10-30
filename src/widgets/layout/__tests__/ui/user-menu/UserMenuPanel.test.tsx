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

    it('이동 링크와 로그아웃 버튼을 평범한 목록으로 그린다', () => {
        render(<UserMenuPanel id="p" user={user} onNavigate={vi.fn()} />);

        const list = screen.getByRole('list', { name: '사용자 메뉴' });
        const items = within(list).getAllByRole('listitem');
        expect(items).toHaveLength(4);
        expect(
            within(list)
                .getAllByRole('link')
                .map(a => a.getAttribute('href'))
        ).toEqual(['/portfolio', '/email-report', '/account']);
        expect(
            within(list).getByRole('button', { name: '로그아웃' })
        ).toBeInTheDocument();
    });

    it('메뉴 역할을 쓰지 않는다', () => {
        render(<UserMenuPanel id="p" user={user} onNavigate={vi.fn()} />);

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    });

    it('링크를 누르면 onNavigate를 부른다', () => {
        const onNavigate = vi.fn();
        render(<UserMenuPanel id="p" user={user} onNavigate={onNavigate} />);

        fireEvent.click(screen.getByRole('link', { name: '계정 설정' }));

        expect(onNavigate).toHaveBeenCalledTimes(1);
    });
});
