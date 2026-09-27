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
 * ⚠️ 이 함수 자체는 콘텐츠를 감추지 않는다 — 반환값만 준다.
 *
 * **2026-09-27부터 호출부는 이 값으로 AI 생성 트리거를 건너뛰지 않는다.**
 * 예전엔 SSE 분석 라우트의 종목 분석·종목 탭 entity actions가 이 값으로
 * `skipEnqueueIfMiss`를 결정해, 검색 색인 봇(Googlebot·Bingbot·Yeti·Daumoa)이
 * 캐시가 비어 있는 종목 페이지를 크롤하면 생성이 트리거되지 않고 "봇 트래픽으로
 * 보여 표시하지 않았어요" 안내문을 그대로 봤다 — 색인되는 게 그 렌더된 DOM이었다.
 * 지금은 봇도 사람과 같은 본문을 생성한다(`src/app/api/analysis/stream/route.ts`
 * 상단 불변식). 그 라우트의 동시성 상한도 더 이상 이 값을 쓰지 않는다
 * (2026-09-27 — `canAcceptAnalysisStream`의 봇 배수 제거, 근거는 그쪽 주석
 * 참고). 이 함수의 남은 호출부:
 * - `src/app/api/presence/route.ts`, `src/app/api/presence/symbol/route.ts` — 방문자/조회수 집계 제외
 * - `src/app/api/ai/chat/stream/route.ts` — 에이전트 챗을 봇에게 아예 막는다(403)
 * - `src/app/ai/[locale]/handoffRedirect.ts` — 봇은 인증 핸드오프 리디렉트를 건너뛴다
 *
 * 시장·거시 브리핑(`submitMarketBriefingAction`·`submitMacroBriefingAction`)은
 * 애초에 이 값을 쓴 적이 없다 — 생성이 시각 버킷당 한 번으로 접혀 비용이 작고,
 * 봇 분기가 `/market`·`/economy` 렌더에 차단 안내문을 색인시키고 있었다
 * (2026-09-17 운영 감사).
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
 * Current callers:
 * - `src/app/api/presence/route.ts` and `src/app/api/presence/symbol/route.ts` — exclude bots from visitor/view counting
 * - `src/app/api/ai/chat/stream/route.ts` — blocks bots from the agent chat entirely (403)
 * - `src/app/ai/[locale]/handoffRedirect.ts` — skips the auth handoff redirect bounce for bots
 *
 * No longer used to suppress AI generation on a cache miss (removed
 * 2026-09-27), and no longer used for the analysis-stream concurrency-cap
 * ceiling either (removed 2026-09-27 — see the long comment above and
 * `canAcceptAnalysisStream` in `shared/lib/sse/activeStreams.ts`).
 */
export function isBot(headers: Headers): boolean {
    const userAgentHeader = headers.get('user-agent') ?? '';
    if (BOT_UA_RE.test(userAgentHeader)) return true;
    const ua = userAgent({ headers });
    return Boolean(ua.isBot);
}
