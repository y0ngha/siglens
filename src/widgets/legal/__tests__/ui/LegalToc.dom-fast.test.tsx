import { render, screen } from '@testing-library/react';
import koMessages from '../../../../../messages/ko.json';
import { LegalToc } from '@/widgets/legal/ui/toc/LegalToc';

const TOC_TITLE = koMessages.widgets.legal.LegalPageShell['7474d0'];
const ITEMS = [
    { id: '1-총칙', label: '1. 총칙' },
    { id: '2-정의', label: '2. 정의' },
] as const;

describe('LegalToc', () => {
    it('names the navigation after its visible title and links each item to its heading anchor', () => {
        render(<LegalToc items={ITEMS} lang="ko" withTopMargin />);

        const nav = screen.getByRole('navigation', { name: TOC_TITLE });
        expect(nav).toHaveTextContent(TOC_TITLE);
        expect(screen.getByRole('link', { name: '1. 총칙' })).toHaveAttribute(
            'href',
            '#1-총칙'
        );
        expect(screen.getByRole('link', { name: '2. 정의' })).toHaveAttribute(
            'href',
            '#2-정의'
        );
    });

    it('marks the item list with the body language', () => {
        render(<LegalToc items={ITEMS} lang="en" withTopMargin />);

        expect(screen.getByRole('list')).toHaveAttribute('lang', 'en');
    });

    it('adds the top margin only when requested', () => {
        const { rerender } = render(
            <LegalToc items={ITEMS} lang="ko" withTopMargin />
        );
        expect(
            screen.getByRole('navigation', { name: TOC_TITLE }).className
        ).toContain('mt-8');

        rerender(<LegalToc items={ITEMS} lang="ko" withTopMargin={false} />);
        expect(
            screen.getByRole('navigation', { name: TOC_TITLE }).className
        ).not.toContain('mt-8');
    });
});
