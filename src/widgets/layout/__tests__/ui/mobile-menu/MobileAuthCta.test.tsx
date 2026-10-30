import { fireEvent, render, screen } from '@testing-library/react';
import { MobileAuthCta } from '../../../ui/mobile-menu/MobileAuthCta';

describe('MobileAuthCta', () => {
    it('회원가입·로그인 링크에 authQuery를 붙인다', () => {
        render(<MobileAuthCta authQuery="?next=%2F" onNavigate={vi.fn()} />);

        expect(screen.getByRole('link', { name: '회원가입' })).toHaveAttribute(
            'href',
            '/signup?next=%2F'
        );
        expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
            'href',
            '/login?next=%2F'
        );
    });

    it('링크를 누르면 onNavigate를 부른다', () => {
        const onNavigate = vi.fn();
        render(<MobileAuthCta authQuery="" onNavigate={onNavigate} />);

        fireEvent.click(screen.getByRole('link', { name: '로그인' }));

        expect(onNavigate).toHaveBeenCalledTimes(1);
    });
});
