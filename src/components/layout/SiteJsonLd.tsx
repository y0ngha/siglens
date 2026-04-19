import { SITE_NAME, SITE_URL } from '@/lib/seo';

export function SiteJsonLd() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${SITE_URL}/{search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
