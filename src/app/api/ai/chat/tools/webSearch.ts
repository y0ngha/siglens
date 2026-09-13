import 'server-only';
import type { ToolExecutor } from './index';

const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const COUNT = 5;
const FRESHNESS: Record<string, string> = {
    day: 'pd',
    week: 'pw',
    month: 'pm',
};
/** Cost-class timeout for external calls (spec §cost-class). */
const TIMEOUT_MS = 8_000;
/** The model fully controls `query`; without a ceiling it can build an arbitrarily long URL. */
const MAX_QUERY_LEN = 400;

interface BraveResult {
    title: string;
    url: string;
    description?: string;
    age?: string;
}

function isHttpUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Brave Web Search snippets only — no page-fetch tool (spec §8). The Brave
 * response is trimmed to `title`/`url`/`snippet`/`age`; nothing else in the
 * raw payload (nor the `X-Subscription-Token` header) ever leaves this
 * function.
 */
export const webSearchTool: ToolExecutor = async (args, ctx) => {
    const key = process.env.BRAVE_SEARCH_API_KEY;
    if (!key) return { error: 'unavailable' };
    const query = String(args.query).slice(0, MAX_QUERY_LEN);

    const url = new URL(ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(COUNT));
    url.searchParams.set('search_lang', ctx.locale === 'ko' ? 'ko' : 'en');
    if (typeof args.freshness === 'string' && FRESHNESS[args.freshness])
        url.searchParams.set('freshness', FRESHNESS[args.freshness]!);

    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'X-Subscription-Token': key,
            },
            signal: AbortSignal.any([
                ctx.signal,
                AbortSignal.timeout(TIMEOUT_MS),
            ]),
        });
    } catch (error) {
        // Own timeout or the caller's turn signal firing — never let this
        // (or any other fetch failure) throw past the tool boundary.
        if (error instanceof Error && error.name === 'AbortError')
            return { error: 'timeout' };
        return { error: 'search_failed' };
    }
    if (!response.ok)
        return { error: 'search_failed', status: response.status };

    let payload: { web?: { results?: BraveResult[] } };
    try {
        // A 200 doesn't guarantee a JSON body — an HTML error page or proxy
        // interstitial parses fine as a `Response` but throws here; never
        // let that escape the tool boundary either.
        payload = (await response.json()) as {
            web?: { results?: BraveResult[] };
        };
    } catch {
        return { error: 'search_failed' };
    }
    const results = (payload.web?.results ?? [])
        .filter(r => isHttpUrl(r.url))
        .slice(0, COUNT)
        .map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.description ?? '',
            age: r.age ?? null,
        }));
    return {
        asOf: new Date().toISOString(),
        source: 'Brave Search',
        results,
    };
};
