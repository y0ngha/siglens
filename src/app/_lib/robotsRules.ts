import { DEFAULT_LOCALE, LOCALES } from '@/shared/i18n/locales';

/**
 * AI 검색·인용 크롤러 그룹의 crawl-delay(초). 10초면 봇 하나가 하루 8,640 URL을 가져가 종목 × 탭
 * 페이지를 며칠 안에 한 바퀴 돌고(60초면 몇 주가 걸려 AI 검색 인용 수집이 사실상 멈춘다), 봇당 평균
 * 0.1 req/s라 오리진 부하는 무시할 수준이다.
 *
 * ⚠️ `Crawl-delay`는 비표준이고 **Google은 무시한다.** Google 계열 토큰을 이 그룹에 넣으면 사실상
 * 무제한이 된다(`GOOGLE_NON_SEARCH_USER_AGENTS` 참고). 나머지 봇의 준수도 best-effort 힌트라 확실한
 * 통제가 필요하면 `Disallow` 또는 Cloudflare 봇 룰을 쓴다.
 */
export const AI_CRAWLER_CRAWL_DELAY_SECONDS = 10;

/**
 * 검색엔진이 아닌 기생 SEO 크롤러(백링크/순위 분석 SaaS) — 전면 Disallow. 포털 랭킹에 기여하지 않고
 * 트래픽만 만든다. 이 봇들은 robots.txt를 준수한다. ⚠️ 실제 검색엔진(Googlebot/Yeti/Bingbot/Daumoa)은
 * 절대 넣지 않는다.
 */
export const PARASITE_BOT_USER_AGENTS = [
    'AhrefsBot',
    'SemrushBot',
    'MJ12bot',
    'DotBot',
    'BLEXBot',
    'DataForSeoBot',
];

/**
 * Google의 비검색 generic 크롤러 — 전면 Disallow. Googlebot과 IP 대역은 공유하지만 기능적으로 분리돼
 * 있어(Google 문서: GoogleOther 대상 설정은 어떤 제품에도 영향을 주지 않는다) 막아도 검색 랭킹·색인·
 * rich result에 페널티가 없고 origin fetch만 준다. ⚠️ Googlebot/Googlebot-Image는 절대 넣지 않는다.
 * AI 학습 opt-out은 `Google-Extended` 소관이라 대상이 아니다.
 *
 * ⚠️ **crawl-delay 그룹에 넣으면 안 된다.** Google은 `Crawl-delay`를 무시하므로 그 그룹에서는
 * `Allow: /` + 무제한이 되어 목록에 넣은 이유가 무효가 된다.
 */
export const GOOGLE_NON_SEARCH_USER_AGENTS = [
    'GoogleOther',
    'GoogleOther-Image',
    'GoogleOther-Video',
];

/**
 * 순수 학습·스크레이핑 크롤러 — 전면 Disallow.
 *
 * 검색 노출도 AI 검색 인용도 만들지 않으면서 종목 페이지 전수를 긁어 ISR write/origin fetch 비용만
 * 만든다. 이 사이트의 상품은 AI 분석 텍스트 자체라 학습 코퍼스로 통째 유출될 이유가 없다. 토큰은
 * 이 부류를 전면 차단하는 주요 발행사·플랫폼 robots.txt의 교집합 + 등장 빈도로 골랐다.
 * ⚠️ 검색 색인 봇(Googlebot/Yeti/Bingbot/Daumoa)은 절대 넣지 않는다.
 */
export const AI_TRAINING_CRAWLER_USER_AGENTS = [
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
 * AI 검색·인용 크롤러 — 차단하지 않고 crawl-delay로 빈도만 낮춘다. 이 봇들이 만드는 인용은 실제
 * 유입이 되고, 성장 단계 사이트에는 "발견되는 것"이 "긁히지 않는 것"보다 가치가 크다.
 */
export const AI_SEARCH_CRAWLER_USER_AGENTS = [
    'GPTBot',
    'OAI-SearchBot',
    'ClaudeBot',
    'Claude-SearchBot',
    'PerplexityBot',
];

/**
 * 사용자가 직접 요청했을 때만 도는 fetcher — 스로틀 없이 명시적으로 전면 허용한다.
 *
 * "사용자가 이 URL을 물어봤다"의 대리자라 막으면 그 사용자에게 우리 페이지가 안 보인다. `*` 그룹으로도
 * 허용되지만, 나중에 `*`를 조이거나 allowlist 모델로 바꿀 때 조용히 함께 막히지 않도록 이름을 박아
 * 둔다. crawl-delay도 붙이지 않는다 — 사용자 대기 시간에 직접 얹힌다.
 */
export const USER_TRIGGERED_FETCHER_USER_AGENTS = [
    'ChatGPT-User',
    'Claude-User',
    'Perplexity-User',
];

/**
 * 자체 fetch를 하지 않는 control token. Googlebot·Applebot이 이미 가져간 콘텐츠의 *사용 권한*만
 * 통제해 origin 트래픽이 0이다. 막으면 Gemini/Apple Intelligence 인용 가시성만 잃으므로 허용한다.
 * 실제로 fetch하는 GoogleOther 계열과 성격이 다르다.
 */
export const AI_USAGE_CONTROL_TOKENS = ['Google-Extended', 'Applebot-Extended'];

/**
 * 허용 그룹 넷(`*`, `Googlebot`, 사용자 트리거 fetcher, AI 검색·인용)이 공유하는 baseline.
 * robots.txt 그룹 배타성 때문에 이름 붙은 그룹은 `*`를 상속하지 않으므로 매 그룹이 이걸 복제해야
 * `/api/` 보호가 유지된다. ⚠️ 여기를 고치면 네 그룹이 함께 바뀐다.
 *
 * `/api/analysis/stream`만 예외로 허용한다 — 분석 요청이 이 라우트로 가므로, 막히면 Googlebot
 * 렌더러가 요청을 못 보내 렌더된 DOM에 에러 배너만 남는다. 비용은 UA가 아니라 사람과 공유하는
 * 캐시 키·SEO prewarm·동시성 상한(`canAcceptAnalysisStream`)이 통제한다. Allow는 더 긴 경로
 * 매칭이 이기므로 `/api/` disallow보다 우선한다.
 */
export const BASELINE_ALLOW = ['/', '/api/analysis/stream'];

/**
 * API 라우트는 JSON·이미지 등 SEO 가치 없는 자원이라 crawl budget 절약을 위해 막는다.
 *
 * 인증 페이지와 `/account`는 막지 않는다 — 페이지 metadata의 `noindex`로 충분하고, robots.txt로도
 * 막으면 Googlebot이 그 `noindex`를 보지 못해 외부 백링크가 생겼을 때 "Indexed though blocked by
 * robots.txt" 빈 카드로 노출될 수 있다.
 */
export const BASELINE_DISALLOW = ['/api/'];

/**
 * 뉴스 **허브**의 OG/twitter 이미지만 Googlebot에 되돌려 준다.
 *
 * Googlebot 그룹이 `/*​/opengraph-image`를 통째로 막은 근거는 종목 OG PNG의 물량(9탭 × 400여 심볼 ×
 * 4로케일 ≈ 1.5만 URL)이다. 뉴스 허브는 `/news`와 `/news/{category}` 6개라 로케일을 곱해도 약 28 URL이고,
 * Discover·이미지 검색에서 이미지가 없으면 카드가 빈다.
 *
 * **로케일을 리터럴로 적는 이유**: robots.txt의 `*`는 `/`까지 먹어, `/*​/news/opengraph-image`는
 * `/ko/AAPL/news/opengraph-image`에도 일치해 종목 뉴스 탭 OG를 다시 열어 버린다. Allow가 Disallow를
 * 이기는 근거는 "더 긴 일치가 우선" 규칙이다(`robots.test.ts`가 허브 허용·심볼 차단 두 방향을 고정한다).
 */
export const HUB_SOCIAL_IMAGE_ALLOW = LOCALES.flatMap(locale =>
    ['opengraph-image', 'twitter-image'].flatMap(image => [
        `/${locale}/news/${image}`,
        `/${locale}/news/*/${image}`,
    ])
);

/**
 * 종목 **색인 탭**(차트·뉴스·공포탐욕)의 한국어 OG 이미지만 Googlebot에 되돌려 준다.
 *
 * 색인 페이지는 이미지가 없으면 Discover·이미지 검색·rich result 카드가 빈다. 롱테일 종목의 이미지도
 * 같이 열리지만 그 페이지가 noindex라 실제 수집은 적다(수용).
 *
 * **패턴이 `/ko/*​/opengraph-image` 하나인 이유**: `*`는 `/`까지 먹으므로 종목 차트와 하위 탭을 한 번에
 * 연다. 열면 안 되는 쪽은 **더 긴 Disallow**로 되돌린다 — 항상 noindex인 탭(`NOINDEX_TAB_OG_DISALLOW`)과
 * 사용자 생성 공유 카드(`SHARE_OG_DISALLOW`). 비-ko 로케일은 계속 막힌다.
 */
export const SYMBOL_OG_ALLOW = [`/${DEFAULT_LOCALE}/*/opengraph-image`];

/**
 * 항상 noindex인 종목 탭(`ALWAYS_NOINDEX_TAB_ROBOTS` + position)의 OG 이미지. 탭 목록은 `seo.ts`를
 * import하지 않고 적는다 — robots는 `SITE_URL`만 의존하도록 두었고(`robots.test.ts`가 그것만 목한다),
 * 탭을 다시 열 때 `ALWAYS_NOINDEX_TAB_ROBOTS`와 함께 여기를 고친다.
 */
export const NOINDEX_TAB_OG_DISALLOW = [
    'overall',
    'financials',
    'fundamental',
    'options',
    'congress',
    'flows',
    'position',
].map(tab => `/${DEFAULT_LOCALE}/*/${tab}/opengraph-image`);

/** 사용자 생성 공유 카드 OG(`/ko/share/{id}/opengraph-image`) — `SYMBOL_OG_ALLOW`가 열지 않게 되돌린다. */
export const SHARE_OG_DISALLOW = [`/${DEFAULT_LOCALE}/share/*/opengraph-image`];
