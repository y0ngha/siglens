import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/lib/seo';

// AI 크롤러(ClaudeBot·Perplexity·OAI 등) 공통 crawl-delay(초). 차단 대신 빈도만 낮추는
// 그룹들이 재사용하므로 export해 테스트가 리터럴 대신 이 상수를 참조하도록 한다.
export const AI_CRAWLER_CRAWL_DELAY_SECONDS = 60;
// Claude-User는 사용자 요청에 따른 단발성 조회이므로 백그라운드 크롤러만 제한한다.
const ANTHROPIC_CRAWLER_USER_AGENTS = ['ClaudeBot', 'Claude-SearchBot'];

// 검색엔진이 아닌 기생 SEO 크롤러(백링크/순위 분석 SaaS). 포털 랭킹에 기여하지 않으면서
// 트래픽만 유발하므로 전면 Disallow한다 — Googlebot/Yeti/Bingbot/Daumoa 등 실제
// 검색엔진은 절대 포함하지 않는다. 이 봇들은 robots.txt를 준수한다.
const PARASITE_BOT_USER_AGENTS = [
    'AhrefsBot',
    'SemrushBot',
    'MJ12bot',
    'DotBot',
    'BLEXBot',
    'DataForSeoBot',
];

// Google의 비검색 generic 크롤러. 검색 색인(Googlebot)과 IP 대역은 공유하지만 기능적으로
// 완전히 분리돼 있다 — Google 공식 문서가 "GoogleOther 대상 크롤링 설정은 어떤 특정 제품에도
// 영향을 주지 않는다"고 명시한다(내부 R&D / one-off 크롤 용도). 따라서 전면 Disallow해도
// 검색 랭킹·색인·rich result에 페널티가 없으며, origin fetch(낮은 캐시율 환경의 비용 요인)만
// 줄인다. Image/Video 변형 토큰도 함께 막는다. ⚠️ Googlebot/Googlebot-Image는 절대 포함 금지
// (검색 색인이 날아간다). AI 학습 opt-out은 별도 토큰 Google-Extended 소관이라 여기 대상 아님.
const GOOGLE_NON_SEARCH_USER_AGENTS = [
    'GoogleOther',
    'GoogleOther-Image',
    'GoogleOther-Video',
];

// AI 학습/콘텐츠 스크레이퍼 크롤러. 검색 색인에 기여하지 않으면서 종목 페이지 전수를 크롤해
// 봇 first-gen ISR write 비용만 유발하므로 전면 Disallow한다. ⚠️ Google-Extended는 Gemini/Vertex
// '학습' opt-out 토큰으로 검색 색인(Googlebot)과 무관 — GoogleOther 계열과 혼동 금지.
// 검색 색인 봇(Googlebot/Yeti/Bingbot/Daumoa)은 절대 포함하지 않는다.
const AI_TRAINING_CRAWLER_USER_AGENTS = [
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
];

// AI 검색·인용 크롤러. ChatGPT/Perplexity 검색의 인용 가시성을 보존하기 위해 차단 대신
// crawlDelay로 빈도만 낮춘다(ClaudeBot과 동일 정책).
const AI_SEARCH_CRAWLER_USER_AGENTS = ['PerplexityBot', 'OAI-SearchBot'];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                // API 라우트는 disallow로 유지 — 응답이 JSON/이미지 등 SEO 가치
                // 없는 자원이라 crawl budget 절약 목적.
                //
                // 인증 페이지(/login, /signup, /forgot-password, /reset-password)
                // 와 /account는 페이지 metadata에 `robots: { index: false }`로
                // noindex가 박혀 있다. 이전엔 robots.txt에서도 Disallow했었지만,
                // 그 조합은 Googlebot이 페이지를 crawl 못해 noindex 태그를 보지
                // 못하는 충돌을 만든다 — 외부 백링크가 생기면 "Indexed though
                // blocked by robots.txt" 상태로 SERP에 빈 카드로 노출될 위험.
                // noindex가 더 강한 신호이므로 그쪽만 유지하고 Disallow는 제거.
                disallow: ['/api/'],
            },
            {
                userAgent: ANTHROPIC_CRAWLER_USER_AGENTS,
                allow: '/',
                // robots.txt는 가장 구체적인 그룹만 적용하고 `*` 그룹을 상속하지 않으므로,
                // crawl-delay 그룹에도 /api/ disallow를 명시해야 한다(미명시 시 API 크롤 허용됨).
                disallow: ['/api/'],
                crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
            },
            {
                userAgent: PARASITE_BOT_USER_AGENTS,
                disallow: '/',
            },
            {
                userAgent: GOOGLE_NON_SEARCH_USER_AGENTS,
                disallow: '/',
            },
            {
                userAgent: AI_TRAINING_CRAWLER_USER_AGENTS,
                disallow: '/',
            },
            {
                userAgent: AI_SEARCH_CRAWLER_USER_AGENTS,
                allow: '/',
                // 위와 동일: 구체 그룹은 `*`의 /api/ disallow를 상속하지 않으므로 명시한다.
                disallow: ['/api/'],
                crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
