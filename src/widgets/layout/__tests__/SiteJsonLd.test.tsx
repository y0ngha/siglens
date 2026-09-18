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

    /**
     * 사이트링크 검색창은 구글이 2023-11에 폐기했고, 우리 `urlTemplate`이 가리키던
     * `/?q=`는 검색 결과가 아니라 심볼 리다이렉트(없으면 404)였다. 아무 기능도
     * 만들지 않으면서 사실과 어긋나는 선언이라 지웠다 — 되살아나지 않게 고정한다.
     */
    it('SearchAction을 광고하지 않는다', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = JSON.parse(script.innerHTML);

        expect('potentialAction' in data).toBe(false);
        expect(script.innerHTML).not.toContain('SearchAction');
    });

    it('includes @id for entity graph referencing', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = JSON.parse(script.innerHTML);

        expect(data['@id']).toBe('https://siglens.io#website');
    });
});
