import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            // Block API routes and auth/account pages — these are noindex anyway,
            // so blocking here saves crawl budget. Sitemap (sitemap.ts) lists none
            // of these paths, so there's no conflicting signal.
            disallow: [
                '/api/',
                '/login',
                '/signup',
                '/forgot-password',
                '/reset-password',
                '/account',
            ],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
