vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import robots from '@/app/robots';

describe('robots', () => {
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

    it('disallows GoogleOther non-search crawlers (search indexing unaffected)', () => {
        const result = robots();
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: expect.arrayContaining([
                    'GoogleOther',
                    'GoogleOther-Image',
                    'GoogleOther-Video',
                ]),
                disallow: '/',
            })
        );
    });

    it('never disallows the real Googlebot search crawler', () => {
        const result = robots();
        const rules = Array.isArray(result.rules)
            ? result.rules
            : [result.rules];
        for (const rule of rules) {
            const agents = Array.isArray(rule.userAgent)
                ? rule.userAgent
                : [rule.userAgent];
            if (
                agents.includes('Googlebot') ||
                agents.includes('Googlebot-Image')
            ) {
                expect(rule.disallow).toBeUndefined();
            }
        }
    });

    it('limits Anthropic automated crawlers to one crawl every 60 seconds', () => {
        const result = robots();
        expect(result.rules).toContainEqual({
            userAgent: ['ClaudeBot', 'Claude-SearchBot'],
            allow: '/',
            crawlDelay: 60,
        });
    });

    it('points sitemap to the correct URL', () => {
        const result = robots();
        expect(result.sitemap).toBe('https://siglens.io/sitemap.xml');
    });
});
