import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/lib/seo';

/**
 * AI 크롤러 공통 crawl-delay(초). 차단 대신 빈도만 낮추는 그룹이 재사용하므로
 * export해 테스트가 리터럴 대신 이 상수를 참조하도록 한다.
 *
 * ⚠️ `Crawl-delay`는 비표준이고 **Google은 무시한다.** 따라서 Google 계열 토큰을
 * 이 그룹에 넣으면 사실상 무제한이 된다 — `GOOGLE_NON_SEARCH_USER_AGENTS` 주석 참고.
 * 나머지 봇의 준수 여부도 문서로 보장되지 않는 best-effort 힌트다. 확실한 통제가
 * 필요하면 `Disallow` 또는 Cloudflare 봇 룰을 써야 한다.
 */
export const AI_CRAWLER_CRAWL_DELAY_SECONDS = 60;

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
//
// ⚠️ **crawl-delay 그룹에 넣으면 안 된다.** Google은 `Crawl-delay`를 무시하므로 그 그룹에
// 두면 `Allow: /` + 무제한이 되어, 목록에 넣은 이유(origin fetch 절감)가 통째로 무효가 된다.
// 실제로 한동안 그 상태였다.
const GOOGLE_NON_SEARCH_USER_AGENTS = [
    'GoogleOther',
    'GoogleOther-Image',
    'GoogleOther-Video',
];

/**
 * 순수 학습·스크레이핑 크롤러 — 전면 Disallow.
 *
 * 이 사이트에 아무 리턴이 없는 부류다. 검색 노출도, AI 검색 인용도 만들지 않으면서
 * 종목 페이지 전수를 긁어 ISR write/origin fetch 비용만 만든다. 이 사이트의 상품은
 * AI 분석 텍스트 자체라 학습 코퍼스로 통째 유출될 이유가 없다.
 *
 * 업계 레퍼런스(2026-08 실측): NYT·Bloomberg·CNBC·네이버뉴스·다이닝코드가 모두
 * 이 부류를 전면 차단한다. 무신사·오늘의집은 allowlist 모델(`* → Disallow: /`)이라
 * 결과적으로 같은 효과다. Investopedia는 3계층으로 나눠 이 부류만 `Disallow: /`한다.
 *
 * 토큰 선정은 위 사이트들의 robots.txt 교집합 + 등장 빈도 기준이다.
 * ⚠️ 검색 색인 봇(Googlebot/Yeti/Bingbot/Daumoa)은 절대 포함하지 않는다.
 */
const AI_TRAINING_CRAWLER_USER_AGENTS = [
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
];

/**
 * AI 검색·인용 크롤러 — 차단하지 않고 crawl-delay로 빈도만 낮춘다.
 *
 * 이 봇들이 만드는 인용은 실제 유입이 된다. siglens는 색인 페이지가 2천 개대인
 * 성장 단계 사이트고, 2026-07 thin-content 노출 절벽에서 막 회복한 참이라
 * "발견되는 것"이 "긁히지 않는 것"보다 가치가 크다.
 *
 * 업계가 두 진영으로 갈린다: 라이선스 협상력이 있는 발행사(CNBC·NYT)는 인용 봇까지
 * 막고, 유통이 필요한 쪽(무신사·MarketWatch·Investopedia의 OpenAI 계층)은 허용한다.
 * siglens는 후자다.
 */
const AI_SEARCH_CRAWLER_USER_AGENTS = [
    'GPTBot',
    'OAI-SearchBot',
    'ClaudeBot',
    'Claude-SearchBot',
    'PerplexityBot',
];

/**
 * 사용자가 직접 요청했을 때만 도는 fetcher — 명시적으로 전면 허용한다.
 *
 * 배경 크롤러가 아니라 "사용자가 이 URL을 물어봤다"의 대리자라, 막으면 그 사용자에게
 * 우리 페이지가 안 보이는 것과 같다. `*` 그룹으로도 허용되지만, 나중에 `*`를 조이거나
 * allowlist 모델로 바꿀 때 조용히 함께 막히지 않도록 **이름을 박아 둔다.**
 * (CNBC는 이 부류까지 막지만 그건 발행사 라이선스 전략이고 이 사이트 상황과 다르다.)
 *
 * crawl-delay도 붙이지 않는다 — 사용자 대기 시간에 직접 얹히기 때문.
 */
const USER_TRIGGERED_FETCHER_USER_AGENTS = [
    'ChatGPT-User',
    'Claude-User',
    'Perplexity-User',
];

/**
 * `Google-Extended`/`Applebot-Extended`는 **자체 fetch를 하지 않는 control token**이다.
 * 각각 Googlebot·Applebot이 이미 가져간 콘텐츠의 *사용 권한*만 통제한다 — origin
 * 트래픽이 0이라 비용 논점이 없고, `Crawl-delay`를 걸어도 의미가 없다.
 *
 * 차단하면 Gemini/Apple Intelligence 인용 가시성만 잃고 비용 이득은 0이므로 허용한다.
 * 검색 색인은 Googlebot 소관이라 무관하다. GoogleOther 계열(실제로 fetch하는 크롤러)과
 * 성격이 완전히 다르니 혼동 금지.
 */
const AI_USAGE_CONTROL_TOKENS = ['Google-Extended', 'Applebot-Extended'];

/**
 * 네 그룹이 공유하는 baseline — `*`, `Googlebot`, 사용자 트리거 fetcher,
 * AI 검색·인용 크롤러. robots.txt 그룹 배타성 때문에 이름 붙은 그룹은 `*`를
 * 상속하지 않으므로 매 그룹이 이걸 복제해야 한다(그래야 `/api/` 보호가 유지된다).
 * ⚠️ 여기를 고치면 네 그룹이 전부 함께 바뀐다.
 */
const BASELINE_ALLOW = ['/', '/api/analysis/stream'];
const BASELINE_DISALLOW = ['/api/'];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                // ⚠️ `/api/analysis/stream`만 예외로 허용한다. 분석 요청은 예전엔
                // Server Action(현재 페이지 URL로 POST — 허용 경로)이었지만 지금은 이
                // API 라우트로 간다. 여기가 막히면 Googlebot 렌더러가 요청 자체를
                // 못 보내 캐시 HIT조차 못 받고, 렌더된 DOM에 에러 배너만 남는다.
                // 봇은 캐시 미스 시 새 분석을 큐에 넣지 않으므로(`skipEnqueueIfMiss`)
                // AI 비용은 0이고, 얻는 건 색인 가능한 분석 텍스트다.
                // Allow는 더 긴 경로 매칭이 이기므로 아래 `/api/` disallow보다 우선한다.
                allow: BASELINE_ALLOW,
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
                disallow: BASELINE_DISALLOW,
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
                // 그룹은 `*` 그룹의 baseline을 그대로 복제해야 한다 — 복제하지 않으면
                // Googlebot이 /api/ 차단 등 baseline 규칙을 잃는다. `BASELINE_*` 상수를
                // 공유하고, parity 테스트가 즉시 실패하도록 가드돼 있다
                // (src/app/__tests__/robots.test.ts).
                //
                // Googlebot-Image는 별도 그룹이 없어도 이 Googlebot 그룹으로 fallback되므로
                // (더 구체적인 "Googlebot-Image" 그룹이 없으면 "Googlebot" 그룹을 따른다)
                // 별도 그룹을 만들 필요가 없다 — 이 disallow가 Google 이미지 검색에서도 함께
                // 적용된다.
                //
                // Trade-off: Google 이미지 검색에서 이 OG/twitter-image가 빠지는 손실은
                // 감수한다(원래 이미지 검색 노출 목적으로 만든 자산이 아니다).
                //
                // ⚠️ **이 disallow를 `*` 그룹으로 올리지 말 것.** 소셜 카드 크롤러가
                // `*` 그룹을 따르기 때문이다. facebookexternalhit은 robots.txt를 사실상
                // 무시하지만 Twitterbot은 준수하므로, `*`에 올리는 순간 트위터 카드
                // 이미지가 깨진다. Bing/Yeti/Daumoa도 같은 PNG를 크롤하긴 하나 Google
                // 대비 물량이 작아 차단 이득보다 카드 파손 리스크가 크다.
                // 굳이 확대하려면 `*`가 아니라 Bingbot/Yeti/Daumoa 전용 그룹을 만들어야
                // 하고, 그 그룹들도 baseline을 복제해야 한다.
                userAgent: 'Googlebot',
                allow: BASELINE_ALLOW,
                disallow: [
                    ...BASELINE_DISALLOW,
                    '/*/opengraph-image',
                    '/*/twitter-image',
                ],
            },
            {
                // 사용자 트리거 fetcher — 스로틀 없이 전면 허용(상수 주석 참고).
                userAgent: USER_TRIGGERED_FETCHER_USER_AGENTS,
                allow: BASELINE_ALLOW,
                disallow: BASELINE_DISALLOW,
            },
            {
                // AI 검색·인용 크롤러 + fetch 없는 usage-control 토큰.
                // 차단 대신 빈도만 낮춰 인용 가시성을 보존한다(상수 주석 참고).
                //
                // robots.txt는 가장 구체적인 그룹만 적용하고 `*`를 상속하지 않으므로,
                // 이 그룹에도 baseline을 명시해야 한다(미명시 시 /api/ 크롤 허용됨).
                userAgent: [
                    ...AI_SEARCH_CRAWLER_USER_AGENTS,
                    ...AI_USAGE_CONTROL_TOKENS,
                ],
                allow: BASELINE_ALLOW,
                disallow: BASELINE_DISALLOW,
                crawlDelay: AI_CRAWLER_CRAWL_DELAY_SECONDS,
            },
            {
                // 순수 학습·스크레이핑 크롤러 전면 차단(상수 주석 참고).
                userAgent: AI_TRAINING_CRAWLER_USER_AGENTS,
                disallow: '/',
            },
            {
                // Google 비검색 크롤러 전면 차단. crawl-delay 그룹에 둘 수 없다 —
                // Google이 `Crawl-delay`를 무시하므로 그 그룹에서는 사실상 무제한이
                // 된다(상수 정의부 주석 참고). 검색 색인은 Googlebot 소관이라 영향 없음.
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
