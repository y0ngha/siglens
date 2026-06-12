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
        // 정확히 3개로 결정적이므로 exact 배열 비교 — 실수로 Googlebot 등이 끼면 즉시 실패한다.
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: [
                    'GoogleOther',
                    'GoogleOther-Image',
                    'GoogleOther-Video',
                ],
                disallow: '/',
            })
        );
    });

    it('never disallows search-critical Google crawlers', () => {
        const result = robots();
        const rules = Array.isArray(result.rules)
            ? result.rules
            : [result.rules];
        // 검색 색인·SC 디버깅에 필수 — GoogleOther 계열과 이름이 비슷해 오타 차단 위험이 크다.
        const criticalGoogleBots = [
            'Googlebot',
            'Googlebot-Image',
            'Googlebot-News',
            'Googlebot-Video',
            'Google-InspectionTool',
        ];
        // disallow:'/' (전면 차단) 규칙에 묶인 user-agent를 모두 모은다.
        const fullyDisallowedAgents = rules
            .filter(rule => rule.disallow === '/')
            .flatMap(rule =>
                Array.isArray(rule.userAgent)
                    ? rule.userAgent
                    : [rule.userAgent]
            );
        // 조건부 if 없이 매 봇을 직접 단언 — vacuous pass(0 assertion 통과)를 방지한다.
        for (const bot of criticalGoogleBots) {
            expect(fullyDisallowedAgents).not.toContain(bot);
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
