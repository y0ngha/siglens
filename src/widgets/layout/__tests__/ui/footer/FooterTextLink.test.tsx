import { render, screen } from '@testing-library/react';
import { FooterTextLink } from '../../../ui/footer/FooterTextLink';
import { FOOTER_LINK_CLASSES } from '../../../ui/footer/footerLinkStyles';

describe('FooterTextLink', () => {
    it('href와 공용 링크 클래스를 적용한다', () => {
        render(<FooterTextLink href="/about">소개</FooterTextLink>);

        const link = screen.getByRole('link', { name: '소개' });
        expect(link).toHaveAttribute('href', '/about');
        expect(link.className).toBe(FOOTER_LINK_CLASSES);
    });
});
