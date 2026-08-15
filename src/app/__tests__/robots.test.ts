vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

import type { MetadataRoute } from 'next';

import robots, { AI_CRAWLER_CRAWL_DELAY_SECONDS } from '@/app/robots';

/**
 * `MetadataRoute.Robots['rules']`는 단일 그룹 객체 또는 배열, 두 형태를 모두 허용하는
 * 타입이다(next의 계약). 거의 모든 테스트가 배열로 정규화한 뒤 특정 성격의 그룹(전면
 * 차단, crawl-delay)에 속한 user-agent만 모아 단언하므로, 그 정규화 + 자주 쓰는 조회를
 * 여기 한 곳에 모아 각 it()가 조회 한 줄 + 단언으로 끝나게 한다.
 */
const toRulesArray = (rules: MetadataRoute.Robots['rules']) =>
    Array.isArray(rules) ? rules : [rules];

const toUserAgents = (rule: ReturnType<typeof toRulesArray>[number]) =>
    Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? ''];

// disallow: '/' (전면 차단) 규칙에 묶인 user-agent를 모두 모은다.
const getFullyDisallowedAgents = (result: MetadataRoute.Robots) =>
    toRulesArray(result.rules)
        .filter(rule => rule.disallow === '/')
        .flatMap(toUserAgents);

// crawlDelay가 붙은 규칙에 묶인 user-agent를 모두 모은다.
const getCrawlDelayAgents = (result: MetadataRoute.Robots) =>
    toRulesArray(result.rules)
        .filter(rule => rule.crawlDelay !== undefined)
        .flatMap(toUserAgents);

describe('robots', () => {
    it('allows all paths for the default user agent but disallows /api/', () => {
        const result = robots();
        expect(result.rules).toContainEqual(
            expect.objectContaining({
                userAgent: '*',
                allow: ['/', '/api/analysis/stream'],
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

    /**
     * GoogleOther 계열은 **전면 Disallow 전용 그룹**에 있어야 한다.
     *
     * 회귀 가드: 한동안 crawl-delay 그룹에 묶여 있었는데, Google은 `Crawl-delay`를
     * 무시하므로 그 상태에서는 `Allow: /` + 무제한이 되어 목록에 넣은 이유(origin
     * fetch 절감)가 통째로 무효였다. crawl-delay 그룹으로 되돌아가면 여기서 깨진다.
     */
    it('GoogleOther 비검색 크롤러는 전면 Disallow 그룹에 있다 (crawl-delay 그룹 아님)', () => {
        const result = robots();

        expect(result.rules).toContainEqual({
            userAgent: [
                'GoogleOther',
                'GoogleOther-Image',
                'GoogleOther-Video',
            ],
            disallow: '/',
        });

        // Google은 Crawl-delay를 무시한다 — crawlDelay가 붙은 그룹에 있으면 무제한이 된다.
        const crawlDelayAgents = getCrawlDelayAgents(result);
        for (const bot of [
            'GoogleOther',
            'GoogleOther-Image',
            'GoogleOther-Video',
        ]) {
            expect(crawlDelayAgents).not.toContain(bot);
        }
    });

    /**
     * `Google-Extended`는 반대로 crawl-delay 그룹에 **남아 있어야** 한다.
     * 자체 HTTP user-agent가 없는 control token이라 origin 트래픽이 0이고,
     * 차단하면 Gemini 인용 가시성만 잃는다(검색 색인은 Googlebot 소관이라 무관).
     */
    it('Google-Extended는 전면 차단되지 않는다 (fetch 없는 control token)', () => {
        const result = robots();
        const fullyDisallowed = getFullyDisallowedAgents(result);
        expect(fullyDisallowed).not.toContain('Google-Extended');
    });

    it('never disallows search-critical crawlers (Google 계열 + Yeti/Bingbot/Daumoa)', () => {
        const result = robots();
        // 검색 색인·SC 디버깅에 필수 — GoogleOther/AI-training 계열과 이름이 비슷해 오타 차단
        // 위험이 크다. Google 계열 + 국내외 포털 검색봇(Naver Yeti/Bing/Daum)을 함께 가드한다.
        const criticalSearchBots = [
            'Googlebot',
            'Googlebot-Image',
            'Googlebot-News',
            'Googlebot-Video',
            'Google-InspectionTool',
            // Naver 공식 크롤러 토큰. `NaverBot`은 공식 문서·실제 robots.txt 어디에도
            // 없는 추측성 변형이니 재추가 금지.
            'Yeti',
            'Bingbot',
            'Daumoa',
            'Daum',
            'DuckDuckBot',
            'Yandexbot',
            'Slurp',
            // ⚠️ `Applebot`(검색 색인)과 `Applebot-Extended`(학습 opt-out 토큰)는
            // 다른 봇이다. 후자는 crawl-delay 그룹에 있는데, 오타로 전자가 차단
            // 그룹에 들어가면 Apple 검색·Siri 색인이 날아간다. 이 diff가 두 토큰을
            // 함께 다루므로 가장 위험한 혼동 지점이다.
            'Applebot',
        ];
        const fullyDisallowedAgents = getFullyDisallowedAgents(result);
        // 조건부 if 없이 매 봇을 직접 단언 — vacuous pass(0 assertion 통과)를 방지한다.
        for (const bot of criticalSearchBots) {
            expect(fullyDisallowedAgents).not.toContain(bot);
        }
    });

    /**
     * crawl-delay 그룹은 **인용 가치가 있는 봇 + fetch 없는 usage-control 토큰**만
     * 담는다. 순수 학습 스크레이퍼는 전면 차단 그룹으로 갔고(아래), Google 비검색
     * 크롤러는 Google이 Crawl-delay를 무시해 별도 차단 그룹으로 갔다(위).
     */
    it('AI 검색·인용 봇과 usage-control 토큰만 crawl-delay 그룹에 둔다', () => {
        const result = robots();

        expect(result.rules).toContainEqual({
            userAgent: [
                'GPTBot',
                'OAI-SearchBot',
                'ClaudeBot',
                'Claude-SearchBot',
                'PerplexityBot',
                'Google-Extended',
                'Applebot-Extended',
            ],
            allow: ['/', '/api/analysis/stream'],
            disallow: ['/api/'],
            crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
        });
    });

    /**
     * 순수 학습·스크레이핑 크롤러 전면 차단. 이 사이트에 리턴이 없는 부류이고,
     * NYT·Bloomberg·CNBC·네이버뉴스·다이닝코드가 모두 같은 조치를 취한다.
     */
    it('순수 학습·스크레이핑 크롤러를 전면 차단한다', () => {
        const result = robots();
        const fullyDisallowed = getFullyDisallowedAgents(result);

        for (const bot of [
            'CCBot',
            'Bytespider',
            'Amazonbot',
            'Diffbot',
            'ImagesiftBot',
            'omgili',
            'Omgilibot',
            'Meta-ExternalAgent',
            'Meta-ExternalFetcher',
            'cohere-ai',
            'cohere-training-data-crawler',
            'anthropic-ai',
            'Claude-Web',
            'Timpibot',
            'Webzio',
            'Webzio-Extended',
            'YouBot',
            'PetalBot',
            'magpie-crawler',
            'Scrapy',
        ]) {
            expect(fullyDisallowed).toContain(bot);
        }
    });

    /**
     * 사용자 트리거 fetcher는 배경 크롤러가 아니라 "사용자가 이 URL을 물어봤다"의
     * 대리자다. 막으면 그 사용자에게 우리 페이지가 안 보이는 것과 같고, crawl-delay를
     * 걸면 사용자 대기 시간에 직접 얹힌다.
     */
    it('사용자 트리거 fetcher는 스로틀·차단 없이 허용한다', () => {
        const result = robots();

        expect(result.rules).toContainEqual({
            userAgent: ['ChatGPT-User', 'Claude-User', 'Perplexity-User'],
            allow: ['/', '/api/analysis/stream'],
            disallow: ['/api/'],
        });

        // 전면 차단 그룹에도, crawl-delay 그룹에도 들어가면 안 된다.
        const blockedOrThrottled = [
            ...getFullyDisallowedAgents(result),
            ...getCrawlDelayAgents(result),
        ];
        for (const bot of ['ChatGPT-User', 'Claude-User', 'Perplexity-User']) {
            expect(blockedOrThrottled).not.toContain(bot);
        }
    });

    /**
     * robots.txt는 그룹 배타성 규약이라 한 user-agent가 두 그룹에 등장하면 어떤
     * 그룹이 적용될지 정의되지 않는다. 토큰 목록이 20개 단위로 커지는 중이라
     * 수동 점검에 맡기지 않고 구조 불변식으로 못박는다.
     */
    it('같은 user-agent가 두 그룹에 중복 등장하지 않는다', () => {
        const result = robots();
        const all = toRulesArray(result.rules).flatMap(toUserAgents);
        const seen = new Set<string>();
        const duplicates = all.filter(ua => {
            const key = ua.toLowerCase();
            if (seen.has(key)) return true;
            seen.add(key);
            return false;
        });

        expect(duplicates).toEqual([]);
        // 목록이 비면 위 단언이 공허하게 통과한다.
        expect(all.length).toBeGreaterThan(30);
    });

    it('points sitemap to the correct URL', () => {
        const result = robots();
        expect(result.sitemap).toBe('https://siglens.io/sitemap.xml');
    });

    describe('Googlebot OG/twitter-image crawl budget 회수', () => {
        // 그룹 배열에서 userAgent(string | string[])가 정확히 'Googlebot' 하나뿐인
        // 그룹을 찾는다 — crawl-delay 통합 그룹(GoogleOther 등)과 혼동 방지.
        const findGroupByUserAgent = (
            rules: MetadataRoute.Robots['rules'],
            userAgent: string
        ) =>
            toRulesArray(rules).find(rule =>
                Array.isArray(rule.userAgent)
                    ? rule.userAgent.length === 1 &&
                      rule.userAgent[0] === userAgent
                    : rule.userAgent === userAgent
            );

        it('Googlebot 전용 그룹이 존재하고 OG/twitter-image 경로를 disallow한다', () => {
            const result = robots();
            const googlebotGroup = findGroupByUserAgent(
                result.rules,
                'Googlebot'
            );
            expect(googlebotGroup).toBeDefined();
            expect(googlebotGroup?.disallow).toEqual(
                expect.arrayContaining([
                    '/*/opengraph-image',
                    '/*/twitter-image',
                ])
            );
        });

        it('Googlebot 그룹은 여전히 루트를 allow해 검색 색인을 보존한다', () => {
            const result = robots();
            const googlebotGroup = findGroupByUserAgent(
                result.rules,
                'Googlebot'
            );
            expect(googlebotGroup?.allow).toContain('/');
            // 분석 SSE 라우트 예외 — 막히면 렌더러가 캐시 HIT조차 못 받는다.
            expect(googlebotGroup?.allow).toContain('/api/analysis/stream');
        });

        it('foot-gun guard: Googlebot 그룹이 `*` 그룹의 baseline(allow/disallow)을 그대로 replicate한다 — Googlebot은 `*` 그룹을 상속하지 않으므로 이 parity가 깨지면 향후 `*` 전용 규칙이 Googlebot에는 적용되지 않는다', () => {
            const result = robots();
            const wildcardGroup = findGroupByUserAgent(result.rules, '*');
            const googlebotGroup = findGroupByUserAgent(
                result.rules,
                'Googlebot'
            );
            expect(wildcardGroup).toBeDefined();
            expect(googlebotGroup).toBeDefined();

            expect(googlebotGroup?.allow).toEqual(wildcardGroup?.allow);

            const wildcardDisallow = Array.isArray(wildcardGroup?.disallow)
                ? wildcardGroup.disallow
                : wildcardGroup?.disallow
                  ? [wildcardGroup.disallow]
                  : [];
            const googlebotDisallow = Array.isArray(googlebotGroup?.disallow)
                ? googlebotGroup.disallow
                : googlebotGroup?.disallow
                  ? [googlebotGroup.disallow]
                  : [];

            for (const rule of wildcardDisallow) {
                expect(googlebotDisallow).toContain(rule);
            }
        });
    });

    /**
     * 인용 가치 있는 봇은 차단하지 않는다 — 이 사이트는 색인 페이지 2천 개대의
     * 성장 단계라 "발견되는 것"이 "긁히지 않는 것"보다 가치가 크다. 무신사·
     * MarketWatch·Investopedia(OpenAI 계층)와 같은 진영.
     */
    it('AI 검색·인용 봇은 전면 차단하지 않는다', () => {
        const result = robots();
        const fullyDisallowed = getFullyDisallowedAgents(result);

        for (const bot of [
            'GPTBot',
            'OAI-SearchBot',
            'ClaudeBot',
            'Claude-SearchBot',
            'PerplexityBot',
        ]) {
            expect(fullyDisallowed).not.toContain(bot);
        }
    });
});
