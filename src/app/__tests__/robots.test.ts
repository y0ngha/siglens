vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import robots from '@/app/robots';

describe('robots', () => {
    it('returns a valid robots config', () => {
        const result = robots();

        expect(result).toBeDefined();
        expect(result.rules).toBeDefined();
    });

    it('allows all paths for all user agents', () => {
        const result = robots();

        expect(result.rules).toEqual(
            expect.objectContaining({
                userAgent: '*',
                allow: '/',
            })
        );
    });

    it('disallows /api/ routes', () => {
        const result = robots();

        expect(result.rules).toEqual(
            expect.objectContaining({
                disallow: ['/api/'],
            })
        );
    });

    it('points sitemap to the correct URL', () => {
        const result = robots();

        expect(result.sitemap).toBe('https://siglens.io/sitemap.xml');
    });
});
