import { render, screen } from '@testing-library/react';
import { PolicyLink } from '@/widgets/legal/ui/markdown/PolicyLink';

describe('PolicyLink', () => {
    it('routes an internal path through the locale-aware link without a new tab', () => {
        render(<PolicyLink href="/account/delete">계정 삭제</PolicyLink>);

        const link = screen.getByRole('link', { name: '계정 삭제' });
        expect(link).toHaveAttribute('href', '/account/delete');
        expect(link).not.toHaveAttribute('target');
    });

    it('opens an external URL in a new tab without an opener', () => {
        render(<PolicyLink href="https://example.com">외부</PolicyLink>);

        const link = screen.getByRole('link', { name: '외부' });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('keeps a mailto link in the same tab (a new tab would be left blank)', () => {
        render(
            <PolicyLink href="mailto:stock.siglens@gmail.com">
                stock.siglens@gmail.com
            </PolicyLink>
        );

        const link = screen.getByRole('link', {
            name: 'stock.siglens@gmail.com',
        });
        expect(link).toHaveAttribute('href', 'mailto:stock.siglens@gmail.com');
        expect(link).not.toHaveAttribute('target');
        expect(link).not.toHaveAttribute('rel');
    });

    it('keeps an in-document anchor in the same tab', () => {
        render(<PolicyLink href="#article-1">제1조</PolicyLink>);

        expect(screen.getByRole('link', { name: '제1조' })).not.toHaveAttribute(
            'target'
        );
    });
});
