import 'server-only';
import {
    naverAiCredentials,
    searchNaverNews,
    searchNaverWeb,
    stripNaverMarkup,
    toIsoPublishedAt,
    type NaverCredentials,
} from '@/entities/news-article/api';
import type { ToolExecutor } from './index';

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
/** Cost-class timeout for external calls (spec §cost-class). */
const TIMEOUT_MS = 8_000;
/** The model fully controls `query`; without a ceiling it can build an arbitrarily long URL. */
const MAX_QUERY_LEN = 400;
const HANGUL_RE = /[가-힣]/;
const LOG_TAG = '[AgentTool] web_search';

interface SearchHit {
    title: string;
    url: string;
    snippet: string;
    age: string | null;
}

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
    signal: AbortSignal
): Promise<ProviderOutcome> {
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(COUNT));
    url.searchParams.set('search_lang', locale === 'ko' ? 'ko' : 'en');
    if (typeof freshness === 'string' && FRESHNESS[freshness])
        url.searchParams.set('freshness', FRESHNESS[freshness]!);

    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'X-Subscription-Token': key,
            },
            signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
        });
    } catch (error) {
        // Own timeout or the caller's turn signal firing — never let this
        // (or any other fetch failure) throw past the tool boundary.
        if (error instanceof Error && error.name === 'AbortError')
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
                title: r.title,
                url: r.url,
                snippet: r.description ?? '',
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
        console.warn(`${LOG_TAG} naver threw`, e instanceof Error ? e.name : e);
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
            e instanceof Error ? e.name : e
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

/**
 * `web_search` = Brave (general web) blended with Naver news + web documents
 * for Korean
 * queries. Naver's index is where Korean government and market coverage
 * actually lives (Brave's own index is thin there); Brave covers everything Naver is not — US regulators,
 * filings, English macro. Either provider alone still works; the tool is
 * unavailable only when neither is configured.
 */
export const webSearchTool: ToolExecutor = async (args, ctx) => {
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    // The agent's own NCP application (`NAVER_AI_CLIENT_*`), never the news
    // ingestion key — separate quota, separate blast radius.
    const naverCreds = naverAiCredentials();
    if (!braveKey && !naverCreds) return { error: 'unavailable' };
    const query = String(args.query).slice(0, MAX_QUERY_LEN);
    // Hangul in the query, not the UI locale: a ko-locale user asking about
    // "SEC 10-K NVDA" gets nothing useful from a Korean news index, and each
    // Naver call is quota.
    const korean = HANGUL_RE.test(query);

    const [naverNews, naverWeb, brave] = await Promise.all([
        naverCreds && korean
            ? searchNaver(query, args.freshness, naverCreds, ctx.signal)
            : [],
        naverCreds && korean
            ? searchNaverWebDocs(query, naverCreds, ctx.signal)
            : [],
        braveKey
            ? searchBrave(
                  braveKey,
                  query,
                  ctx.locale,
                  args.freshness,
                  ctx.signal
              )
            : null,
    ]);

    // Brave is the only provider that can fail loudly; when it is the only
    // one we asked, surface its failure the way the tool always has.
    const naver = [...naverNews, ...naverWeb];
    if (brave !== null && !brave.ok && naver.length === 0)
        return brave.status !== undefined
            ? { error: brave.error, status: brave.status }
            : { error: brave.error };

    const seen = new Set<string>();
    const results = [
        ...naver,
        ...(brave !== null && brave.ok ? brave.hits : []),
    ]
        .filter(hit => {
            if (seen.has(hit.url)) return false;
            seen.add(hit.url);
            return true;
        })
        .slice(0, COUNT);
    const sources = [
        ...(naverNews.length > 0 ? ['Naver News'] : []),
        ...(naverWeb.length > 0 ? ['Naver Web'] : []),
        ...(brave !== null && brave.ok ? ['Brave Search'] : []),
    ];
    return {
        asOf: new Date().toISOString(),
        // Naver-only + non-Korean query: nothing was searched, and the model
        // must not be told a provider found nothing.
        source: sources.join(' + ') || 'none',
        results,
    };
};
