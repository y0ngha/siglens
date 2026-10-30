// vi.mock → imports 순서 (TESTING.md#TE-1)
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryTab } from '../../ui/tabs/CategoryTab';

describe('CategoryTab', () => {
    it('활성 탭은 링크가 아닌 aria-current 텍스트다', () => {
        render(
            <CategoryTab
                tab={{
                    category: 'articles',
                    href: '/news/articles',
                    labelKey: 'articles.shortLabel',
                    active: true,
                }}
                label="아티클 탭"
            />
        );
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        const current = screen.getByText('아티클 탭');
        expect(current.tagName).toBe('SPAN');
        expect(current).toHaveAttribute('aria-current', 'page');
        expect(current).toHaveClass('border-primary-500', 'font-medium');
    });

    it('비활성 탭은 aria-current 없는 링크다', () => {
        render(
            <CategoryTab
                tab={{
                    category: 'general',
                    href: '/news/general',
                    labelKey: 'general.shortLabel',
                    active: false,
                }}
                label="일반 탭"
            />
        );
        const link = screen.getByRole('link', { name: '일반 탭' });
        expect(link).toHaveAttribute('href', '/news/general');
        expect(link).not.toHaveAttribute('aria-current');
        expect(link).toHaveClass('text-secondary-400');
        expect(link).not.toHaveClass('border-primary-500');
    });
});
