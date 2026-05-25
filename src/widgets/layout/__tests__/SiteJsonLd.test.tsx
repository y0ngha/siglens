vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: ({ data }: { data: Record<string, unknown> }) => (
        <script
            type="application/ld+json"
            data-testid="json-ld"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    ),
}));

import { render, screen } from '@testing-library/react';

import { SiteJsonLd } from '../SiteJsonLd';

describe('SiteJsonLd', () => {
    it('renders a JSON-LD script with WebSite type', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = JSON.parse(script.innerHTML);

        expect(data['@type']).toBe('WebSite');
        expect(data['@context']).toBe('https://schema.org');
    });

    it('includes site name and URL', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = JSON.parse(script.innerHTML);

        expect(data.name).toBe('Siglens');
        expect(data.url).toBe('https://siglens.io');
    });

    it('includes SearchAction with urlTemplate', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = JSON.parse(script.innerHTML);

        expect(data.potentialAction['@type']).toBe('SearchAction');
        expect(data.potentialAction.target.urlTemplate).toContain(
            '?q={search_term_string}'
        );
    });

    it('includes @id for entity graph referencing', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = JSON.parse(script.innerHTML);

        expect(data['@id']).toBe('https://siglens.io#website');
    });
});
