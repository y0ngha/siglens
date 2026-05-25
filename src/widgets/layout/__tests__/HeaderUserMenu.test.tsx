import { vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HeaderUserMenu } from '@/widgets/layout/HeaderUserMenu';

vi.mock('@/features/auth-logout/ui/LogoutButton', () => ({
    LogoutButton: () => <button>로그아웃</button>,
}));

describe('HeaderUserMenu', () => {
    it('currentUser=null이면 로그인/회원가입 링크를 렌더한다', () => {
        render(<HeaderUserMenu currentUser={null} />);
        expect(
            screen.getByRole('link', { name: '로그인' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: '회원가입' })
        ).toBeInTheDocument();
    });

    it('currentUser가 주어지면 사용자 메뉴 트리거를 렌더한다', () => {
        render(
            <HeaderUserMenu
                currentUser={{
                    email: 'user@example.com',
                    name: 'Yongha',
                    tier: 'member',
                    avatarUrl: null,
                }}
            />
        );
        const trigger = screen.getByRole('button', {
            name: /사용자 메뉴/,
        });
        expect(trigger).toBeInTheDocument();
        // Initial — uses display name first character.
        expect(trigger).toHaveTextContent('Y');
    });

    it('avatarUrl이 있으면 이미지를 렌더한다', () => {
        render(
            <HeaderUserMenu
                currentUser={{
                    email: 'user@example.com',
                    name: 'Yongha',
                    tier: 'member',
                    avatarUrl: 'https://lh3.googleusercontent.com/a/avatar.jpg',
                }}
            />
        );
        const img = screen.getByRole('img');
        expect(img).toBeInTheDocument();
    });

    it('트리거 클릭시 메뉴가 열리고 이름과 이메일이 표시된다', () => {
        render(
            <HeaderUserMenu
                currentUser={{
                    email: 'user@example.com',
                    name: 'Yongha',
                    tier: 'free',
                    avatarUrl: null,
                }}
            />
        );
        const trigger = screen.getByRole('button', {
            name: /사용자 메뉴/,
        });
        fireEvent.click(trigger);
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(menu).toHaveTextContent('Yongha');
        expect(menu).toHaveTextContent('user@example.com');
    });

    it('이름이 null이면 이메일의 첫 글자를 이니셜로 사용한다', () => {
        render(
            <HeaderUserMenu
                currentUser={{
                    email: 'alice@example.com',
                    name: null,
                    tier: 'pro',
                    avatarUrl: null,
                }}
            />
        );
        const trigger = screen.getByRole('button', {
            name: /사용자 메뉴/,
        });
        expect(trigger).toHaveTextContent('A');
    });
});
