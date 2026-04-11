import type { MetadataRoute } from 'next';
import { PRIVACY_PATH, SITE_URL, TERMS_PATH } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: ['/', PRIVACY_PATH, TERMS_PATH],
            disallow: '/api/',
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
