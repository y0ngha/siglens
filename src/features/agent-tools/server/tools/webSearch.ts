import 'server-only';
import { extractQueryTerms } from '@/features/agent-tools/lib/pageExcerptText';
import type { ToolExecutor } from '@/features/agent-tools/model';
import {
    fetchPageExcerpt,
    type PageExcerptResult,
} from '@/features/agent-tools/server/fetchPageExcerpt';
import {
    getCachedSearch,
    searchCacheKey,
    setCachedSearch,
    shareInFlight,
} from '@/features/agent-tools/server/webSearchCache';
import {
    naverAiCredentials,
    searchNaverNews,
    searchNaverWeb,
    stripNaverMarkup,
    toIsoPublishedAt,
    type NaverCredentials,
} from '@/shared/api/naver/naverSearch';
import type {
    WebSearchExcerptStatus,
    WebSearchResultItem,
} from '@/shared/api/web/webSearchResult';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const COUNT = 5;
/** Korean queries: Naver news, then Naver web documents, then Brave fills to `COUNT`. */
const NAVER_NEWS_SHARE = 3;
const NAVER_WEB_SHARE = 2;
const FRESHNESS: Record<string, string> = {
    day: 'pd',
    week: 'pw',
    month: 'pm',
};
/**
 * 시간 예산(CC-7: 최악의 합). core는 `external` 도구에 15초 천장을 둔다(`limits.ts`). 한국어 질의의 최악은 Naver 4초
 * + Brave 6초(앞 단계가 끝난 뒤 순서대로) + 페이지 발췌 3초 = 13초이고, 아래 마감이 그 합을 넘기지 못하게 한다.
 */
const NAVER_TIMEOUT_MS = 4_000;
const BRAVE_TIMEOUT_MS = 6_000;
const EXECUTOR_DEADLINE_MS = 13_000;
const PAGE_PHASE_MAX_MS = 3_500;
/** 마감 직전에 응답을 만들 여유. */
const PAGE_PHASE_MARGIN_MS = 300;
/** 이보다 적게 남았으면 페이지 단계를 건너뛴다(robots.txt 확인만으로 끝나 버린다). */
const PAGE_PHASE_MIN_MS = 1_000;
const EXCERPT_COUNT = 2;
/** 발췌를 붙이지 않는 호스트: 로그인 벽·동영상·SNS는 본문 문단이 없거나 약관이 막는다. */
const EXCERPT_SKIPPED_HOSTS: readonly string[] = [
    'x.com',
    'twitter.com',
    'youtube.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'linkedin.com',
];
/**
 * 결과 한 건의 제목·스니펫·URL 상한. 제공자는 길이를 보장하지 않고, 결과 전체 상한
 * (`WEB_SEARCH_RESULT_MAX_CHARS`)은 이 값들로 잰 최악의 경우에 맞춰 있다.
 */
const MAX_TITLE_CHARS = 400;
const MAX_SNIPPET_CHARS = 400;
const MAX_URL_CHARS = 500;
/** The model fully controls `query`; without a ceiling it can build an arbitrarily long URL. */
const MAX_QUERY_LEN = 400;
const HANGUL_RE = /[가-힣]/;
/**
 * Queries the market assistant has no business sending: search operators
 * (`site:github.com …`) and secret-hunting terms. The prompt already scopes
 * `web_search` to market facts; this is the server-side backstop for a turn
 * where the model is talked out of it — the paid search never runs.
 */
const OUT_OF_SCOPE_QUERY_RE =
    /\b(?:site|filetype|inurl|intitle|intext|ext):|\.env\b|api[\s_-]?key|secret[\s_-]?key|password|비밀번호|환경\s?변수/i;
const LOG_TAG = '[AgentTool] web_search';

type SearchHit = Pick<WebSearchResultItem, 'title' | 'url' | 'snippet' | 'age'>;

interface BraveResult {
    title: string;
    url: string;
    description?: string;
    age?: string;
}

function isHttpUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
}

type ProviderOutcome =
    | { ok: true; hits: SearchHit[] }
    | { ok: false; error: 'timeout' | 'search_failed'; status?: number };

/**
 * Brave Web Search snippets only — no page-fetch tool (spec §8). The Brave
 * response is trimmed to `title`/`url`/`snippet`/`age`; nothing else in the
 * raw payload (nor the `X-Subscription-Token` header) ever leaves this
 * function.
 */
async function searchBrave(
    key: string,
    query: string,
    locale: string,
    freshness: unknown,
    signal: AbortSignal,
    timeoutMs: number
): Promise<ProviderOutcome> {
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(COUNT));
    url.searchParams.set('search_lang', locale === 'ko' ? 'ko' : 'en');
    const freshnessParam =
        typeof freshness === 'string' ? FRESHNESS[freshness] : undefined;
    if (freshnessParam) url.searchParams.set('freshness', freshnessParam);

    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'X-Subscription-Token': key,
            },
            signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
        });
    } catch (error) {
        // Own timeout or the caller's turn signal firing — never let this
        // (or any other fetch failure) throw past the tool boundary.
        // `AbortSignal.timeout`이 끊으면 fetch는 `TimeoutError`로, 턴 신호가 끊으면 `AbortError`로 거절된다.
        if (
            error instanceof Error &&
            (error.name === 'AbortError' || error.name === 'TimeoutError')
        )
            return { ok: false, error: 'timeout' };
        return { ok: false, error: 'search_failed' };
    }
    if (!response.ok)
        return { ok: false, error: 'search_failed', status: response.status };

    let payload: { web?: { results?: BraveResult[] } };
    try {
        // A 200 doesn't guarantee a JSON body — an HTML error page or proxy
        // interstitial parses fine as a `Response` but throws here; never
        // let that escape the tool boundary either.
        payload = (await response.json()) as {
            web?: { results?: BraveResult[] };
        };
    } catch {
        return { ok: false, error: 'search_failed' };
    }
    return {
        ok: true,
        hits: (payload.web?.results ?? [])
            .filter(r => isHttpUrl(r.url))
            .slice(0, COUNT)
            .map(r => ({
                // Brave highlights matches with `<strong>` and encodes quotes as
                // `&#x27;`; left in, the model quotes the markup back to the user.
                title: stripNaverMarkup(r.title),
                url: r.url,
                snippet: stripNaverMarkup(r.description ?? ''),
                age: r.age ?? null,
            })),
    };
}

/**
 * Naver news search (NCP API HUB) — the same client `/news/kr` runs on. It
 * degrades to `[]` on any failure by contract, so it never fails the tool.
 * Recency-sorted when the model asked for fresh results; relevance-sorted
 * otherwise (see the client's measured title-hit rates for why).
 */
async function searchNaver(
    query: string,
    freshness: unknown,
    creds: NaverCredentials,
    signal: AbortSignal
): Promise<SearchHit[]> {
    const sort = freshness === 'day' || freshness === 'week' ? 'date' : 'sim';
    let items;
    try {
        items = await searchNaverNews(
            query,
            NAVER_NEWS_SHARE,
            LOG_TAG,
            sort,
            signal,
            creds
        );
    } catch (e) {
        // The client promises to degrade, but one provider must never be able
        // to take the other's successful result down with it.
        console.warn(
            `${LOG_TAG} naver threw`,
            e instanceof Error ? e.name : redactDbErrorForLog(e)
        );
        return [];
    }
    return items
        .map(item => ({
            title: stripNaverMarkup(item.title ?? ''),
            // The publisher's own URL when it is a real http(s) link; Naver's
            // mirror otherwise (an app-scheme or relative `originallink` must
            // not cost the hit).
            url:
                item.originallink && isHttpUrl(item.originallink)
                    ? item.originallink
                    : (item.link ?? ''),
            snippet: stripNaverMarkup(item.description ?? ''),
            age: toIsoPublishedAt(item.pubDate),
        }))
        .filter(hit => hit.title !== '' && isHttpUrl(hit.url));
}

/**
 * Naver web documents (`webkr`) — Korean government, agency and company pages
 * that are not news. Same never-throws contract.
 */
async function searchNaverWebDocs(
    query: string,
    creds: NaverCredentials,
    signal: AbortSignal
): Promise<SearchHit[]> {
    let items;
    try {
        items = await searchNaverWeb(
            query,
            NAVER_WEB_SHARE,
            LOG_TAG,
            creds,
            signal
        );
    } catch (e) {
        console.warn(
            `${LOG_TAG} naver webkr threw`,
            e instanceof Error ? e.name : redactDbErrorForLog(e)
        );
        return [];
    }
    return items
        .map(item => ({
            title: stripNaverMarkup(item.title ?? ''),
            url: item.link ?? '',
            snippet: stripNaverMarkup(item.description ?? ''),
            age: null,
        }))
        .filter(hit => hit.title !== '' && isHttpUrl(hit.url));
}

function clip(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max);
}

/** 크기 상한 안에 들도록 다듬고, 상한을 넘는 URL은 버린다. */
function bounded(hit: SearchHit): SearchHit | null {
    if (hit.url.length > MAX_URL_CHARS) return null;
    return {
        ...hit,
        title: clip(hit.title, MAX_TITLE_CHARS),
        snippet: clip(hit.snippet, MAX_SNIPPET_CHARS),
    };
}

function dedupeByUrl(hits: readonly SearchHit[]): SearchHit[] {
    const seen = new Set<string>();
    return hits.flatMap(hit => {
        const kept = bounded(hit);
        if (kept === null || seen.has(kept.url)) return [];
        seen.add(kept.url);
        return [kept];
    });
}

function hostOf(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

function isExcerptCandidate(url: string): boolean {
    const host = hostOf(url);
    if (host === '') return false;
    if (EXCERPT_SKIPPED_HOSTS.some(h => host === h || host.endsWith(`.${h}`)))
        return false;
    try {
        return !new URL(url).pathname.toLowerCase().endsWith('.pdf');
    } catch {
        return false;
    }
}

type BraveState = 'called' | 'skipped' | 'failed' | 'refused';

interface SearchStats {
    brave: BraveState;
    naverHits: number;
    braveHits: number;
    excerpts: number;
    excerptFailures: Partial<Record<WebSearchExcerptStatus, number>>;
}

interface SearchOutcome {
    result: unknown;
    /** 캐시에 둘 수 있는 성공 결과인가(오류·제공자가 빠진 결과는 아니다). */
    cacheable: boolean;
    stats: SearchStats;
}

interface SearchInput {
    query: string;
    freshness: unknown;
    korean: boolean;
    braveKey: string | undefined;
    naverCreds: NaverCredentials | null;
    cacheKey: string;
    started: number;
}

const EMPTY_STATS: SearchStats = {
    brave: 'skipped',
    naverHits: 0,
    braveHits: 0,
    excerpts: 0,
    excerptFailures: {},
};

/** 상위 결과에 페이지 발췌를 붙인다. 시간이 모자라면 건너뛰고 결과를 그대로 돌려준다. */
async function withExcerpts(
    results: readonly SearchHit[],
    query: string,
    signal: AbortSignal,
    deadlineAt: number
): Promise<{
    items: WebSearchResultItem[];
    excerpts: number;
    failures: SearchStats['excerptFailures'];
}> {
    const budget = Math.min(
        PAGE_PHASE_MAX_MS,
        deadlineAt - Date.now() - PAGE_PHASE_MARGIN_MS
    );
    const targets = results
        .map((hit, index) => ({ hit, index }))
        .filter(({ hit }) => isExcerptCandidate(hit.url))
        .slice(0, EXCERPT_COUNT);
    const terms = extractQueryTerms(query);
    const fetched: Array<readonly [number, PageExcerptResult]> =
        budget < PAGE_PHASE_MIN_MS
            ? []
            : await Promise.all(
                  targets.map(
                      async ({ hit, index }) =>
                          [
                              index,
                              await fetchPageExcerpt(
                                  hit.url,
                                  terms,
                                  signal,
                                  budget
                              ),
                          ] as const
                  )
              );
    const byIndex = new Map(fetched);
    const items = results.map((hit, index): WebSearchResultItem => {
        const outcome = byIndex.get(index);
        if (outcome === undefined) return hit;
        if (!outcome.ok) return { ...hit, excerptStatus: outcome.status };
        return {
            ...hit,
            excerpt: outcome.excerpt,
            ...(outcome.publishedAt !== null
                ? { publishedAt: outcome.publishedAt }
                : {}),
        };
    });
    const failures = fetched.reduce<SearchStats['excerptFailures']>(
        (acc, [, outcome]) =>
            outcome.ok
                ? acc
                : { ...acc, [outcome.status]: (acc[outcome.status] ?? 0) + 1 },
        {}
    );
    return {
        items,
        excerpts: fetched.filter(([, outcome]) => outcome.ok).length,
        failures,
    };
}

async function runSearch(
    input: SearchInput,
    args: Record<string, unknown>,
    ctx: Parameters<ToolExecutor>[1]
): Promise<SearchOutcome> {
    const { query, korean, braveKey, naverCreds, started } = input;
    const deadlineAt = started + EXECUTOR_DEADLINE_MS;

    // Korean queries ask Naver first; Brave is the fallback for the slots Naver did not fill.
    const naverSignal = AbortSignal.any([
        ctx.signal,
        AbortSignal.timeout(NAVER_TIMEOUT_MS),
    ]);
    const [naverNews, naverWeb] =
        naverCreds && korean
            ? await Promise.all([
                  searchNaver(query, args.freshness, naverCreds, naverSignal),
                  searchNaverWebDocs(query, naverCreds, naverSignal),
              ])
            : [[], []];
    const naver = dedupeByUrl([...naverNews, ...naverWeb]);

    // The service-wide Brave budget is charged here, immediately before the billed request, and only
    // when Brave is really needed (a cache hit and a Naver-filled answer never reach this point).
    const braveWanted = braveKey !== undefined && naver.length < COUNT;
    const claim = braveWanted ? await ctx.claimWebSearchUnit?.() : undefined;
    if (claim !== undefined && !claim.ok && naver.length === 0)
        return {
            result: claim.refusal,
            cacheable: false,
            stats: { ...EMPTY_STATS, brave: 'refused' },
        };
    const braveAllowed = braveWanted && (claim === undefined || claim.ok);
    const brave =
        braveAllowed && braveKey !== undefined
            ? await searchBrave(
                  braveKey,
                  query,
                  ctx.locale,
                  args.freshness,
                  ctx.signal,
                  Math.max(
                      1,
                      Math.min(BRAVE_TIMEOUT_MS, deadlineAt - Date.now())
                  )
              )
            : null;
    const braveStateOf = (): BraveState => {
        if (brave === null) return braveWanted ? 'refused' : 'skipped';
        return brave.ok ? 'called' : 'failed';
    };
    const braveState = braveStateOf();
    const baseStats = {
        ...EMPTY_STATS,
        brave: braveState,
        naverHits: naver.length,
        braveHits: brave !== null && brave.ok ? brave.hits.length : 0,
    };

    // Brave is the only provider that can fail loudly; when it is the only
    // one we asked, surface its failure the way the tool always has.
    if (brave !== null && !brave.ok && naver.length === 0)
        return {
            result:
                brave.status !== undefined
                    ? { error: brave.error, status: brave.status }
                    : { error: brave.error },
            cacheable: false,
            stats: baseStats,
        };

    const hits = dedupeByUrl([
        ...naver,
        ...(brave !== null && brave.ok ? brave.hits : []),
    ]).slice(0, COUNT);
    const sources = [
        ...(naverNews.length > 0 ? ['Naver News'] : []),
        ...(naverWeb.length > 0 ? ['Naver Web'] : []),
        ...(brave !== null && brave.ok ? ['Brave Search'] : []),
    ];
    const { items, excerpts, failures } = await withExcerpts(
        hits,
        query,
        ctx.signal,
        deadlineAt
    );
    const payload = {
        asOf: new Date().toISOString(),
        // Naver-only + non-Korean query: nothing was searched, and the model
        // must not be told a provider found nothing.
        source: sources.join(' + ') || 'none',
        results: items,
    };
    // A degraded answer is not kept, so the next call retries: Brave failed or was refused, the turn was
    // aborted mid-search, or a page read ended on `timeout`/`error` (it may work next time). `robots`,
    // `not_html`, `too_large` and `blocked` describe the page itself and stay cacheable.
    const cacheable =
        (braveState === 'called' || braveState === 'skipped') &&
        !ctx.signal.aborted &&
        !failures.timeout &&
        !failures.error;
    if (cacheable) setCachedSearch(input.cacheKey, payload, input.freshness);
    return {
        result: payload,
        cacheable,
        stats: { ...baseStats, excerpts, excerptFailures: failures },
    };
}

/**
 * Single-line JSON (multi-line objects break Logs Insights). No query text and no URLs: the query may
 * carry what the user typed.
 */
function logTelemetry(
    korean: boolean,
    cache: 'hit' | 'miss',
    stats: SearchStats,
    started: number
): void {
    console.info(
        JSON.stringify({
            tag: LOG_TAG,
            korean,
            cache,
            brave: stats.brave,
            naverHits: stats.naverHits,
            braveHits: stats.braveHits,
            excerpts: stats.excerpts,
            excerptFailures: stats.excerptFailures,
            ms: Date.now() - started,
        })
    );
}

/**
 * `web_search` = Naver news + web documents first for Korean queries, Brave (general web) for everything
 * Naver did not fill and for every non-Korean query. Naver's index is where Korean government and market
 * coverage actually lives (Brave's own index is thin there); Brave covers everything Naver is not — US
 * regulators, filings, English macro. Either provider alone still works; the tool is unavailable only
 * when neither is configured.
 *
 * The top two results carry an `excerpt` read from the page itself (`fetchPageExcerpt`). Results are kept
 * in an in-memory cache for at most 15 minutes (`webSearchCache.ts`: Brave's terms allow only transient
 * storage). With `webSearchMetering: 'executor'` the global budget is charged by
 * `ctx.claimWebSearchUnit` right before the Brave request.
 */
export const webSearchTool: ToolExecutor = async (args, ctx) => {
    const started = Date.now();
    const braveKey = process.env.BRAVE_SEARCH_API_KEY || undefined;
    // The agent's own NCP application (`NAVER_AI_CLIENT_*`), never the news
    // ingestion key — separate quota, separate blast radius.
    const naverCreds = naverAiCredentials();
    if (!braveKey && !naverCreds) return { error: 'unavailable' };
    const query = String(args.query).slice(0, MAX_QUERY_LEN);
    if (OUT_OF_SCOPE_QUERY_RE.test(query)) return { error: 'out_of_scope' };
    // Hangul in the query, not the UI locale: a ko-locale user asking about
    // "SEC 10-K NVDA" gets nothing useful from a Korean news index, and each
    // Naver call is quota.
    const korean = HANGUL_RE.test(query);
    const cacheKey = searchCacheKey({
        query,
        freshness: args.freshness,
        searchLang: ctx.locale === 'ko' ? 'ko' : 'en',
        braveConfigured: braveKey !== undefined,
        naverConfigured: naverCreds !== null,
    });

    const cached = getCachedSearch<object>(cacheKey);
    if (cached !== undefined) {
        logTelemetry(korean, 'hit', EMPTY_STATS, started);
        return { ...cached, cached: true };
    }
    const search = () =>
        runSearch(
            {
                query,
                freshness: args.freshness,
                korean,
                braveKey,
                naverCreds,
                cacheKey,
                started,
            },
            args,
            ctx
        );
    const first = await shareInFlight(cacheKey, search);
    // The shared value came out of another caller's turn. If it is degraded (aborted turn, refusal, failed
    // provider) and ours is still live, search once on our own rather than inherit someone else's failure.
    const { value, shared } =
        first.shared && !first.value.cacheable && !ctx.signal.aborted
            ? await shareInFlight(cacheKey, search)
            : first;
    if (shared) {
        // Waited on an identical call already running: no provider work of our own.
        logTelemetry(korean, 'hit', EMPTY_STATS, started);
        return value.cacheable &&
            typeof value.result === 'object' &&
            value.result !== null
            ? { ...value.result, cached: true }
            : value.result;
    }
    logTelemetry(korean, 'miss', value.stats, started);
    return value.result;
};
