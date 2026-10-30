import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { UserAvatarButton } from '../../../ui/user-menu/UserAvatarButton';

const user = {
    email: 'user@example.com',
    name: 'Yongha',
    tier: 'member' as const,
    avatarUrl: null,
};

describe('UserAvatarButton', () => {
    it('이니셜을 보이고 이름에 티어를 담는다', () => {
        render(
            <UserAvatarButton
                ref={createRef()}
                user={user}
                isOpen={false}
                panelId="p1"
                onClick={vi.fn()}
            />
        );

        const button = screen.getByRole('button', { name: /사용자 메뉴/ });
        expect(button).toHaveTextContent('Y');
        expect(button).not.toHaveAttribute('aria-haspopup');
    });

    it('열려 있을 때만 aria-controls로 패널을 가리킨다', () => {
        const { rerender } = render(
            <UserAvatarButton
                ref={createRef()}
                user={user}
                isOpen={false}
                panelId="p1"
                onClick={vi.fn()}
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-expanded',
            'false'
        );
        expect(screen.getByRole('button')).not.toHaveAttribute('aria-controls');

        rerender(
            <UserAvatarButton
                ref={createRef()}
                user={user}
                isOpen
                panelId="p1"
                onClick={vi.fn()}
            />
        );
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-controls',
            'p1'
        );
    });

    it('avatarUrl이 있으면 이니셜 대신 이미지를 그린다', () => {
        render(
            <UserAvatarButton
                ref={createRef()}
                user={{ ...user, avatarUrl: 'https://example.com/a.jpg' }}
                isOpen={false}
                panelId="p1"
                onClick={vi.fn()}
            />
        );

        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(screen.getByRole('button')).not.toHaveTextContent('Y');
    });

    it('클릭을 전달한다', () => {
        const onClick = vi.fn();
        render(
            <UserAvatarButton
                ref={createRef()}
                user={user}
                isOpen={false}
                panelId="p1"
                onClick={onClick}
            />
        );

        fireEvent.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
