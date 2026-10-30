import { render, screen } from '@testing-library/react';
import { GuideNavLink } from '../../../ui/nav/GuideNavLink';

describe('GuideNavLink', () => {
    it('가이드 허브로 가는 짧은 라벨 링크다', () => {
        render(<GuideNavLink active={false} />);

        expect(screen.getByRole('link', { name: '가이드' })).toHaveAttribute(
            'href',
            '/guide'
        );
    });

    it('active일 때만 aria-current="page"', () => {
        const { rerender } = render(<GuideNavLink active />);
        expect(screen.getByRole('link')).toHaveAttribute(
            'aria-current',
            'page'
        );

        rerender(<GuideNavLink active={false} />);
        expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
    });
});
