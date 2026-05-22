import { SITE_NAME, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/ui/JsonLd';

export function SiteJsonLd() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
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
