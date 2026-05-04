import { SITE_NAME, SITE_URL } from '@/lib/seo';
import { JsonLd } from '@/components/ui/JsonLd';

export function SiteJsonLd() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
    };
    return <JsonLd data={data} />;
}
