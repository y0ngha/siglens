import { userAgent } from 'next/server';

/**
 * Next의 `userAgent().isBot`이 놓치는 봇 토큰.
 *
 * Next 내장 정규식은 Googlebot·Bingbot·소셜 카드 크롤러 + GPTBot 정도만 잡는다.
 * AI 크롤러 대부분과 기생 SEO 크롤러, 스크립트 클라이언트가 전부 통과한다 —
 * 그 구멍이 방문자 집계(`/api/presence`)를 부풀리고 AI 잡 큐를 낭비시킨다.
 *
 * 토큰 목록은 `src/app/robots.ts`의 그룹들과 의도적으로 겹친다. 그쪽은 크롤러에게
 * 보내는 *요청*이고 여기는 우리 쪽 *판정*이라 준수 여부와 무관하게 동작해야 한다.
 * robots.txt에 토큰을 추가할 때 여기도 같이 보는 것을 권한다.
 *
 * ⚠️ 이 함수 자체는 콘텐츠를 감추지 않는다 — 반환값만 준다. 다만 호출부
 * (SSE 분석 라우트, 게이트된 entity actions)가 이 값으로 **AI 생성 트리거를
 * 건너뛴다**(`skipEnqueueIfMiss` 등). 그래서 검색 색인 봇(Googlebot·Bingbot·
 * Yeti·Daumoa)이 캐시가 비어 있는 페이지를 크롤하면 생성이 트리거되지 않고
 * 안내문(BotBlockedNotice 등)을 그대로 본다 — 색인되는 건 그 렌더된 DOM이다.
 * 이것이 봇이 보게 되는 페이지에 SSR 캐시 시드(`peekBriefingStatic` 패턴)를
 * 두는 이유다: 시드가 있으면 캐시가 비어도 실제 콘텐츠가 먼저 노출된다.
 */
const BOT_UA_RE = new RegExp(
    [
        // AI 검색·인용·학습 크롤러
        'GPTBot',
        'OAI-SearchBot',
        'ChatGPT-User',
        'ClaudeBot',
        'Claude-User',
        'Claude-SearchBot',
        'Claude-Web',
        'anthropic-ai',
        'PerplexityBot',
        'Perplexity-User',
        'Google-CloudVertexBot',
        'Gemini-Deep-Research',
        'Google-Extended',
        'GoogleOther',
        'DuckAssistBot',
        'MistralAI-User',
        'cohere-ai',
        'Bytespider',
        'Amazonbot',
        'Applebot',
        'Meta-External',
        'CCBot',
        'Diffbot',
        'ImagesiftBot',
        'omgili',
        'Timpibot',
        'Webzio',
        'YouBot',
        'PetalBot',
        'magpie-crawler',
        // 기생 SEO / 백링크 크롤러
        'AhrefsBot',
        'SemrushBot',
        'MJ12bot',
        'DotBot',
        'BLEXBot',
        'DataForSeoBot',
        'Barkrowler',
        'ZoominfoBot',
        'Screaming Frog',
        // 국내 검색 봇 — Next 정규식에 없다
        'Yeti',
        'Daumoa',
        'NaverBot',
        // 브라우저가 아닌 클라이언트. 사람이면 이런 UA가 나올 수 없다.
        'HeadlessChrome',
        'Chrome-Lighthouse',
        'PhantomJS',
        'Scrapy',
        'python-requests',
        'aiohttp',
        'httpx',
        'curl/',
        'Wget/',
        'Go-http-client',
        'node-fetch',
        'axios/',
        'okhttp',
        'Java/',
        'PostmanRuntime',
        'HeadlessFirefox',
        // 가동 감시 서비스
        'UptimeRobot',
        'Pingdom',
        'StatusCake',
        'Better Uptime',
        'Site24x7',
    ]
        .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
    'i'
);

/**
 * Determines whether the incoming request is a bot/crawler based on the
 * `User-Agent` header. Wraps Next.js' official `userAgent` helper so call
 * sites stay simple and so the detection can be swapped out later if needed.
 *
 * Used by Server Actions to suppress Redis worker dispatch on crawler
 * traffic (see the SSE analysis route and the gated entity actions).
 */
export function isBot(headers: Headers): boolean {
    const userAgentHeader = headers.get('user-agent') ?? '';
    if (BOT_UA_RE.test(userAgentHeader)) return true;
    const ua = userAgent({ headers });
    return Boolean(ua.isBot);
}
