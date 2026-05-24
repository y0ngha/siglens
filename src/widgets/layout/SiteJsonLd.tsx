import { SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';

export function SiteJsonLd() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        // @id로 IRI를 박아 다른 페이지의 WebPage가 isPartOf로 정확히 참조할 수
        // 있게 한다 — schema.org 권장 entity graph 패턴.
        '@id': `${SITE_URL}#website`,
        name: SITE_NAME,
        url: SITE_URL,
        // urlTemplate은 홈의 `?q=` 핸들러(src/app/page.tsx)와 짝을 이룬다.
        // SearchAction이 광고됐는데 핸들러가 빠지면 sitelinks searchbox 신호가 깨진다.
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
    return <JsonLd data={data} />;
}
