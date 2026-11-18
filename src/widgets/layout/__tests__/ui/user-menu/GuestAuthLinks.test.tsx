import { render, screen } from '@testing-library/react';
import { GuestAuthLinks } from '../../../ui/user-menu/GuestAuthLinks';

describe('GuestAuthLinks', () => {
    it('로그인·회원가입 링크를 prefetch 없이 authQuery와 함께 그린다', () => {
        render(<GuestAuthLinks authQuery="?next=%2F" />);

        expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
            'href',
            '/login?next=%2F'
        );
        expect(screen.getByRole('link', { name: '회원가입' })).toHaveAttribute(
            'href',
            '/signup?next=%2F'
        );
    });
});
