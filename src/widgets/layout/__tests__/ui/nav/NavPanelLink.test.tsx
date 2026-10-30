import { fireEvent, render, screen } from '@testing-library/react';
import { NavPanelLink } from '../../../ui/nav/NavPanelLink';

describe('NavPanelLink', () => {
    it('href와 라벨을 그리고 prefetch를 끈다', () => {
        render(
            <NavPanelLink
                href="/market/kr"
                label="한국"
                active={false}
                tone="region"
                onNavigate={vi.fn()}
            />
        );

        expect(screen.getByRole('link', { name: '한국' })).toHaveAttribute(
            'href',
            '/market/kr'
        );
    });

    it('active면 aria-current="page", 아니면 속성이 없다', () => {
        const { rerender } = render(
            <NavPanelLink
                href="/market"
                label="미국"
                active
                tone="region"
                onNavigate={vi.fn()}
            />
        );
        expect(screen.getByRole('link')).toHaveAttribute(
            'aria-current',
            'page'
        );

        rerender(
            <NavPanelLink
                href="/market"
                label="미국"
                active={false}
                tone="region"
                onNavigate={vi.fn()}
            />
        );
        expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
    });

    it('클릭하면 onNavigate를 부른다', () => {
        const onNavigate = vi.fn();
        render(
            <NavPanelLink
                href="/market"
                label="미국"
                active={false}
                tone="region"
                onNavigate={onNavigate}
            />
        );

        fireEvent.click(screen.getByRole('link'));

        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('하위(leaf) 톤은 들여쓴다', () => {
        render(
            <NavPanelLink
                href="/news/stock"
                label="미국 주식"
                active={false}
                tone="leaf"
                onNavigate={vi.fn()}
            />
        );
        expect(screen.getByRole('link').className).toContain('pl-7');
    });
});
