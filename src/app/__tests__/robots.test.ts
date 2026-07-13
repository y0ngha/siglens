vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import robots, { AI_CRAWLER_CRAWL_DELAY_SECONDS } from '@/app/robots';

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

    it('GoogleOther 비검색 크롤러는 전면 Disallow 대신 crawl-delay 그룹에 포함된다', () => {
        const result = robots();
        // Anthropic/AI 학습/AI 검색 크롤러와 통합된 단일 crawl-delay 그룹에 속한다.
        // 실수로 Googlebot 본체가 이 그룹에 끼면 즉시 실패하도록 arrayContaining으로 멤버십만 확인한다.
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: expect.arrayContaining([
                    'GoogleOther',
                    'GoogleOther-Image',
                    'GoogleOther-Video',
                ]),
                allow: '/',
                disallow: ['/api/'],
                crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
            })
        );
    });

    it('never disallows search-critical crawlers (Google 계열 + Yeti/Bingbot/Daumoa)', () => {
        const result = robots();
        const rules = Array.isArray(result.rules)
            ? result.rules
            : [result.rules];
        // 검색 색인·SC 디버깅에 필수 — GoogleOther/AI-training 계열과 이름이 비슷해 오타 차단
        // 위험이 크다. Google 계열 + 국내외 포털 검색봇(Naver Yeti/Bing/Daum)을 함께 가드한다.
        const criticalSearchBots = [
            'Googlebot',
            'Googlebot-Image',
            'Googlebot-News',
            'Googlebot-Video',
            'Google-InspectionTool',
            'Yeti',
            'Bingbot',
            'Daumoa',
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
        for (const bot of criticalSearchBots) {
            expect(fullyDisallowedAgents).not.toContain(bot);
        }
    });

    it('limits Anthropic 크롤러를 포함한 통합 crawl-delay 그룹을 60초 간격으로 제한한다(and keeps /api/ disallowed)', () => {
        const result = robots();
        // ANTHROPIC/GOOGLE_NON_SEARCH/AI_TRAINING/AI_SEARCH 4개 크롤러군이 하나의
        // allow+crawlDelay 그룹으로 통합됐다. 전면 Disallow는 검색 랭킹에 기여하지
        // 않는 봇이라도 origin fetch 자체는 허용해 인용 가시성을 보존하려는 의도다.
        expect(result.rules).toContainEqual({
            userAgent: [
                'ClaudeBot',
                'Claude-SearchBot',
                'GoogleOther',
                'GoogleOther-Image',
                'GoogleOther-Video',
                'GPTBot',
                'Google-Extended',
                'Applebot-Extended',
                'Bytespider',
                'CCBot',
                'Meta-ExternalAgent',
                'Amazonbot',
                'anthropic-ai',
                'cohere-ai',
                'Diffbot',
                'Omgilibot',
                'ImagesiftBot',
                'PerplexityBot',
                'OAI-SearchBot',
            ],
            allow: '/',
            disallow: ['/api/'],
            crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
        });
    });

    it('points sitemap to the correct URL', () => {
        const result = robots();
        expect(result.sitemap).toBe('https://siglens.io/sitemap.xml');
    });

    it('AI 학습/스크레이퍼 크롤러는 전면 Disallow 대신 crawl-delay 그룹으로 허용한다', () => {
        const result = robots();
        // 검색 색인에 기여하지 않는 크롤러라도 전면 차단은 하지 않고 빈도만 낮추는 쪽으로
        // 정책이 통합됐다. origin fetch 비용 절감은 crawlDelay로 달성한다.
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: expect.arrayContaining([
                    'GPTBot',
                    'Google-Extended',
                    'Applebot-Extended',
                    'Bytespider',
                    'CCBot',
                    'Meta-ExternalAgent',
                    'Amazonbot',
                    'anthropic-ai',
                    'cohere-ai',
                    'Diffbot',
                    'Omgilibot',
                    'ImagesiftBot',
                ]),
                allow: '/',
                disallow: ['/api/'],
                crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
            })
        );
    });

    it('AI 검색·인용 크롤러는 crawlDelay로 허용하되 /api/는 disallow한다(접근 보존)', () => {
        const result = robots();
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: expect.arrayContaining([
                    'PerplexityBot',
                    'OAI-SearchBot',
                ]),
                allow: '/',
                disallow: ['/api/'],
                crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
            })
        );
    });
});
