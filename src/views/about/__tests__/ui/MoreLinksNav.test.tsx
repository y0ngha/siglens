import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { MoreLinksNav } from '../../ui/more/MoreLinksNav';

const LINKS = [
    { href: '/market', label: 'US market' },
    { href: '/fear-greed', label: 'Fear & Greed' },
];

const AI_LINK = {
    href: 'https://ai.example.test/en/about',
    label: 'About the AI',
};

function renderNav() {
    renderWithIntl(
        <MoreLinksNav title="More pages" links={LINKS} aiLink={AI_LINK} />,
        { locale: 'en' }
    );
}

describe('MoreLinksNav', () => {
    it('names the nav by its h2', () => {
        renderNav();
        const nav = screen.getByRole('navigation', { name: 'More pages' });
        expect(
            within(nav).getByRole('heading', { level: 2 })
        ).toHaveTextContent('More pages');
    });

    it('locale-prefixes the site paths and lists the AI link last', () => {
        renderNav();
        const nav = screen.getByRole('navigation', { name: 'More pages' });
        expect(
            within(nav)
                .getAllByRole('link')
                .map(link => [link.textContent, link.getAttribute('href')])
        ).toEqual([
            ['US market', '/en/market'],
            ['Fear & Greed', '/en/fear-greed'],
            ['About the AI', 'https://ai.example.test/en/about'],
        ]);
    });
});
