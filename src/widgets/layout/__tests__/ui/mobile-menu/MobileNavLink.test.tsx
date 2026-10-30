import { fireEvent, render, screen } from '@testing-library/react';
import { MobileNavLink } from '../../../ui/mobile-menu/MobileNavLink';

describe('MobileNavLink', () => {
    it('active면 aria-current="page"와 강조 보더를 단다', () => {
        render(
            <MobileNavLink
                href="/market"
                label="미국"
                active
                onNavigate={vi.fn()}
            />
        );

        const link = screen.getByRole('link', { name: '미국' });
        expect(link).toHaveAttribute('aria-current', 'page');
        expect(link.className).toContain('border-primary-500');
    });

    it('개별 tabindex를 달지 않는다', () => {
        render(
            <MobileNavLink
                href="/market"
                label="미국"
                active={false}
                onNavigate={vi.fn()}
            />
        );

        expect(screen.getByRole('link')).not.toHaveAttribute('tabindex');
    });

    it('indented면 하위 항목 들여쓰기를 적용한다', () => {
        render(
            <MobileNavLink
                href="/news/stock"
                label="미국 주식"
                active={false}
                onNavigate={vi.fn()}
                indented
            />
        );

        expect(screen.getByRole('link').className).toContain('pl-8');
    });

    it('클릭하면 onNavigate를 부른다', () => {
        const onNavigate = vi.fn();
        render(
            <MobileNavLink
                href="/market"
                label="미국"
                active={false}
                onNavigate={onNavigate}
            />
        );

        fireEvent.click(screen.getByRole('link'));

        expect(onNavigate).toHaveBeenCalledTimes(1);
    });
});
