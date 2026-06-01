vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import robots from '@/app/robots';

describe('robots', () => {
    it('returns a valid robots config', () => {
        const result = robots();
        expect(result).toBeDefined();
        expect(Array.isArray(result.rules)).toBe(true);
    });

    it('allows all paths for the default user agent but disallows /api/', () => {
        const result = robots();
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: '*',
                allow: '/',
                disallow: ['/api/'],
            })
        );
    });

    it('disallows parasite SEO crawlers entirely', () => {
        const result = robots();
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: expect.arrayContaining([
                    'AhrefsBot',
                    'SemrushBot',
                    'MJ12bot',
                    'DotBot',
                    'BLEXBot',
                    'DataForSeoBot',
                ]),
                disallow: '/',
            })
        );
    });

    it('points sitemap to the correct URL', () => {
        const result = robots();
        expect(result.sitemap).toBe('https://siglens.io/sitemap.xml');
    });
});
