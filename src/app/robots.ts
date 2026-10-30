import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/lib/seo';
import {
    AI_CRAWLER_CRAWL_DELAY_SECONDS,
    AI_SEARCH_CRAWLER_USER_AGENTS,
    AI_TRAINING_CRAWLER_USER_AGENTS,
    AI_USAGE_CONTROL_TOKENS,
    BASELINE_ALLOW,
    BASELINE_DISALLOW,
    GOOGLE_NON_SEARCH_USER_AGENTS,
    HUB_SOCIAL_IMAGE_ALLOW,
    NOINDEX_TAB_OG_DISALLOW,
    PARASITE_BOT_USER_AGENTS,
    SHARE_OG_DISALLOW,
    SYMBOL_OG_ALLOW,
    USER_TRIGGERED_FETCHER_USER_AGENTS,
} from './_lib/robotsRules';

/**
 * `/robots.txt`. 봇 부류별 그룹을 조립한다 — 목록과 경로 규칙의 근거는 `_lib/robotsRules.ts`.
 *
 * robots.txt는 가장 구체적인 그룹만 적용하고 `*`를 상속하지 않으므로, 허용 그룹은 모두
 * `BASELINE_ALLOW`/`BASELINE_DISALLOW`를 명시한다(`robots.test.ts`가 parity를 고정한다).
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: BASELINE_ALLOW,
                disallow: BASELINE_DISALLOW,
            },
            {
                // Googlebot 전용 그룹. 종목 페이지마다 동적 생성되는 OG PNG가 크롤 예산의 상당
                // 부분(Search Console 크롤 통계 기준 61GB)을 소모하므로 막아 실제 콘텐츠 페이지에
                // 예산을 돌린다. 색인 탭의 한국어 OG와 뉴스 허브 이미지만 더 긴 Allow로 되돌린다. Googlebot-Image는 별도 그룹이 없으면 이 그룹을 따르므로
                // 이미지 검색에도 같이 적용된다.
                //
                // ⚠️ **이 disallow를 `*` 그룹으로 올리지 말 것.** 소셜 카드 크롤러(Twitterbot 등)가 `*`
                // 그룹을 따르므로 카드 이미지가 깨진다. 확대하려면 Bingbot/Yeti/Daumoa 전용 그룹을
                // 만들고 그 그룹들에도 baseline을 복제한다.
                userAgent: 'Googlebot',
                allow: [
                    ...BASELINE_ALLOW,
                    ...HUB_SOCIAL_IMAGE_ALLOW,
                    ...SYMBOL_OG_ALLOW,
                ],
                disallow: [
                    ...BASELINE_DISALLOW,
                    '/*/opengraph-image',
                    // 종목 탭에는 twitter-image 라우트가 없지만 뉴스 허브(`/news`·`/news/{category}`)에
                    // 남아 있어 유지한다.
                    '/*/twitter-image',
                    ...NOINDEX_TAB_OG_DISALLOW,
                    ...SHARE_OG_DISALLOW,
                ],
            },
            {
                userAgent: USER_TRIGGERED_FETCHER_USER_AGENTS,
                allow: BASELINE_ALLOW,
                disallow: BASELINE_DISALLOW,
            },
            {
                // 차단 대신 빈도만 낮춰 인용 가시성을 보존한다.
                userAgent: [
                    ...AI_SEARCH_CRAWLER_USER_AGENTS,
                    ...AI_USAGE_CONTROL_TOKENS,
                ],
                allow: BASELINE_ALLOW,
                disallow: BASELINE_DISALLOW,
                crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
            },
            {
                userAgent: AI_TRAINING_CRAWLER_USER_AGENTS,
                disallow: '/',
            },
            {
                // crawl-delay 그룹에 둘 수 없다 — Google은 `Crawl-delay`를 무시한다.
                userAgent: GOOGLE_NON_SEARCH_USER_AGENTS,
                disallow: '/',
            },
            {
                userAgent: PARASITE_BOT_USER_AGENTS,
                disallow: '/',
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
