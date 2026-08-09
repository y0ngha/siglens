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
                // ⚠️ `/api/analysis/stream`만 예외로 허용한다. 분석 요청은 예전엔
                // Server Action(현재 페이지 URL로 POST — 허용 경로)이었지만 지금은 이
                // API 라우트로 간다. 여기가 막히면 Googlebot 렌더러가 요청 자체를
                // 못 보내 캐시 HIT조차 못 받고, 렌더된 DOM에 에러 배너만 남는다.
                // Allow는 더 긴 경로 매칭이 이기므로 아래 `/api/` disallow보다 우선한다.
                allow: ['/', '/api/analysis/stream'],
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
                // Googlebot 전용 그룹. `/[symbol]/**/opengraph-image`, `/[symbol]/**/twitter-image`는
                // 종목 페이지마다 동적 생성되는 PNG로, Search Console 크롤 통계 기준 크롤
                // 예산의 상당 부분(61GB)을 여기서 소모하고 있었다 — 실제 콘텐츠 페이지 대신
                // 이 이미지 URL을 반복 크롤하느라 예산이 낭비되는 구조. Disallow로 회수해
                // 실제 종목 콘텐츠 페이지 크롤에 예산을 재배분한다.
                //
                // ⚠️ robots.txt 그룹 배타성 foot-gun: Googlebot은 가장 구체적인 그룹(자기
                // 이름과 정확히 일치하는 그룹)만 읽고 `*` 그룹을 상속하지 않는다. 따라서 이
                // 그룹은 `*` 그룹의 baseline(`allow: '/'`, `disallow: ['/api/']`)을 그대로
                // 복제해야 한다 — 복제하지 않으면 Googlebot이 /api/ 차단 등 baseline 규칙을
                // 잃는다. 앞으로 `*` 그룹에만 규칙을 추가하고 여기 반영을 잊으면 parity 테스트가
                // 즉시 실패하도록 가드돼 있다(src/app/__tests__/robots.test.ts).
                //
                // Googlebot-Image는 별도 그룹이 없어도 이 Googlebot 그룹으로 fallback되므로
                // (더 구체적인 "Googlebot-Image" 그룹이 없으면 "Googlebot" 그룹을 따른다)
                // 별도 그룹을 만들 필요가 없다 — 이 disallow가 Google 이미지 검색에서도 함께
                // 적용된다.
                //
                // Trade-off: Google 이미지 검색에서 이 OG/twitter-image가 빠지는 손실은
                // 감수한다(원래 이미지 검색 노출 목적으로 만든 자산이 아니다). 소셜 크롤러
                // (Twitterbot, facebookexternalhit 등)는 카드 렌더링을 위해 이 경로를
                // 반드시 fetch해야 하지만 영향 없음 — 이들은 자체 그룹을 갖거나(별도 UA)
                // robots.txt 자체를 사실상 무시하고 OG 메타 태그 fetch를 강행한다.
                userAgent: 'Googlebot',
                // `*` 그룹과 동일한 예외 — 분석 SSE 라우트만 허용(위 주석 참조).
                allow: ['/', '/api/analysis/stream'],
                disallow: ['/api/', '/*/opengraph-image', '/*/twitter-image'],
            },
            {
                userAgent: [
                    ...ANTHROPIC_CRAWLER_USER_AGENTS,
                    ...GOOGLE_NON_SEARCH_USER_AGENTS,
                    ...AI_TRAINING_CRAWLER_USER_AGENTS,
                    ...AI_SEARCH_CRAWLER_USER_AGENTS,
                ],
                // `*` 그룹과 동일한 예외 — 분석 SSE 라우트만 허용(위 주석 참조).
                allow: ['/', '/api/analysis/stream'],
                // robots.txt는 가장 구체적인 그룹만 적용하고 `*` 그룹을 상속하지 않으므로,
                // crawl-delay 그룹에도 /api/ disallow를 명시해야 한다(미명시 시 API 크롤 허용됨).
                disallow: ['/api/'],
                crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
            },
            {
                userAgent: PARASITE_BOT_USER_AGENTS,
                disallow: '/',
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
