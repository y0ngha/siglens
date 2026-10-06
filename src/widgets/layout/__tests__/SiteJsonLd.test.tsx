vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
    SITE_NAME_KO: '시그렌즈',
    SITE_URL: 'https://siglens.io',
    ORGANIZATION_JSON_LD_ID: 'https://siglens.io#organization',
    buildOrganizationCoreJsonLd: () => ({
        '@type': 'Organization',
        '@id': 'https://siglens.io#organization',
        name: 'Siglens',
        url: 'https://siglens.io',
    }),
}));

/** `@graph`에서 `@type`으로 노드 하나를 꺼낸다. */
function nodeOf(
    data: { '@graph': Record<string, unknown>[] },
    type: string
): Record<string, unknown> {
    const node = data['@graph'].find(n => n['@type'] === type);
    expect(node).toBeDefined();
    return node as Record<string, unknown>;
}
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
        const data = nodeOf(JSON.parse(script.innerHTML), 'WebSite');

        expect(data['@type']).toBe('WebSite');
        expect(JSON.parse(script.innerHTML)['@context']).toBe(
            'https://schema.org'
        );
    });

    it('includes site name and URL', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = nodeOf(JSON.parse(script.innerHTML), 'WebSite');

        expect(data.name).toBe('Siglens');
        expect(data.url).toBe('https://siglens.io');
    });

    /**
     * 영문 `Siglens`는 동명 프로젝트(SigLens)와 겹친다. 한글 표기를 `alternateName`
     * 첫 후보로 실어야 "시그렌즈" 검색이 이 사이트로 귀결된다 — 빠지면 구조화
     * 데이터에 한글 브랜드가 한 군데도 남지 않는다.
     */
    it('alternateName에 한글 표기를 첫 후보로 싣는다', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = nodeOf(JSON.parse(script.innerHTML), 'WebSite');

        expect(data.alternateName).toEqual(['시그렌즈', 'SIGLENS']);
    });

    /**
     * 사이트링크 검색창은 구글이 2023-11에 폐기했고, 우리 `urlTemplate`이 가리키던
     * `/?q=`는 검색 결과가 아니라 심볼 리다이렉트(없으면 404)였다. 아무 기능도
     * 만들지 않으면서 사실과 어긋나는 선언이라 지웠다 — 되살아나지 않게 고정한다.
     */
    it('SearchAction을 광고하지 않는다', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = nodeOf(JSON.parse(script.innerHTML), 'WebSite');

        expect('potentialAction' in data).toBe(false);
        expect(script.innerHTML).not.toContain('SearchAction');
    });

    it('includes @id for entity graph referencing', () => {
        render(<SiteJsonLd />);

        const script = screen.getByTestId('json-ld');
        const data = nodeOf(JSON.parse(script.innerHTML), 'WebSite');

        expect(data['@id']).toBe('https://siglens.io#website');
    });

    it('publisher가 홈의 Organization 노드를 @id로 가리킨다(그래프에 붙인다)', () => {
        render(<SiteJsonLd />);

        const graph = JSON.parse(screen.getByTestId('json-ld').innerHTML);

        expect(nodeOf(graph, 'WebSite').publisher).toEqual({
            '@id': 'https://siglens.io#organization',
        });
    });

    /**
     * `publisher`의 참조 대상이 같은 문서 안에 있어야 홈이 아닌 페이지에서도 풀린다. 홈의 풍부한
     * Organization 노드와 같은 `@id`라 핵심 속성 값은 단일 소스(`buildOrganizationCoreJsonLd`)다.
     */
    it('publisher가 가리키는 Organization 최소 노드를 같은 @graph에 싣는다', () => {
        render(<SiteJsonLd />);

        const graph = JSON.parse(screen.getByTestId('json-ld').innerHTML);

        expect(nodeOf(graph, 'Organization')).toEqual({
            '@type': 'Organization',
            '@id': 'https://siglens.io#organization',
            name: 'Siglens',
            url: 'https://siglens.io',
        });
    });
});
