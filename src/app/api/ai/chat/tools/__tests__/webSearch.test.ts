const naver = vi.hoisted(() => ({
    creds: false,
    search: vi.fn<
        (q: string, n: number, tag: string, sort: string) => Promise<unknown[]>
    >(),
    web: vi.fn<
        (
            q: string,
            n: number,
            tag: string,
            creds: unknown
        ) => Promise<unknown[]>
    >(),
}));
vi.mock('@/shared/api/naver/naverSearch', () => ({
    naverAiCredentials: () => (naver.creds ? AI_CREDS : null),
    searchNaverNews: naver.search,
    searchNaverWeb: naver.web,
    stripNaverMarkup: (s: string) => s.replace(/<[^>]*>/g, ''),
    toIsoPublishedAt: (d?: string) => (d ? new Date(d).toISOString() : null),
}));

const excerpt = vi.hoisted(() => ({
    fetch: vi.fn<
        (
            url: string,
            terms: readonly string[],
            signal: AbortSignal,
            budgetMs: number
        ) => Promise<unknown>
    >(),
}));
vi.mock('@/app/api/ai/chat/tools/fetchPageExcerpt', () => ({
    fetchPageExcerpt: excerpt.fetch,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { webSearchTool } from '@/app/api/ai/chat/tools/webSearch';
import { __resetWebSearchCacheForTests } from '@/app/api/ai/chat/tools/webSearchCache';
import { WEB_SEARCH_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

const AI_CREDS = { id: 'ai-id', secret: 'ai-secret' };

const rt = {} as never;
const ctx = (locale: 'ko' | 'en', claim?: () => Promise<unknown>) =>
    ({
        locale,
        signal: new AbortController().signal,
        userId: 'u',
        ...(claim ? { claimWebSearchUnit: claim } : {}),
    }) as never;

function braveResponse(results: Array<{ title: string; url: string }>) {
    return new Response(
        JSON.stringify({
            web: {
                results: results.map(r => ({
                    ...r,
                    description: `d:${r.title}`,
                    age: '1 day ago',
                })),
            },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
    );
}

const naverItems = [
    {
        title: '<b>금융위</b> 발표',
        originallink: 'https://gov.kr/a',
        link: 'https://n.news.naver.com/a',
        description: '요약 <b>1</b>',
        pubDate: 'Sat, 13 Sep 2026 09:00:00 +0900',
    },
    {
        title: '두 번째',
        link: 'https://news.example/b',
        description: '요약 2',
        pubDate: 'Sat, 13 Sep 2026 08:00:00 +0900',
    },
];

describe('web_search (Brave + Naver)', () => {
    beforeEach(() => {
        naver.creds = false;
        naver.search.mockReset();
        naver.web.mockReset();
        naver.web.mockResolvedValue([]);
        vi.stubEnv('BRAVE_SEARCH_API_KEY', '');
        __resetWebSearchCacheForTests();
        excerpt.fetch.mockReset();
        excerpt.fetch.mockResolvedValue({ ok: false, status: 'robots' });
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('neither provider configured → unavailable, no network', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('must not be called'));
        expect(await webSearchTool({ query: '금리' }, ctx('ko'), rt)).toEqual({
            error: 'unavailable',
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
        'site:github.com siglens .env',
        'siglens filetype:env',
        'DEEPSEEK api key 유출',
        '서버 환경 변수 목록',
    ])(
        '검색 연산자·비밀정보 탐색 쿼리 %j → out_of_scope, 유료 검색 미호출',
        async query => {
            vi.stubEnv('BRAVE_SEARCH_API_KEY', 'brave-key');
            naver.creds = true;
            const fetchSpy = vi
                .spyOn(globalThis, 'fetch')
                .mockRejectedValue(new Error('must not be called'));
            expect(await webSearchTool({ query }, ctx('ko'), rt)).toEqual({
                error: 'out_of_scope',
            });
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(naver.search).not.toHaveBeenCalled();
        }
    );

    it('Korean query with both keys: Naver news first, Brave fills, URL-deduped, capped at 5, source names both', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        naver.creds = true;
        naver.search.mockResolvedValue(naverItems);
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            braveResponse([
                { title: 'dup', url: 'https://gov.kr/a' },
                { title: 'w1', url: 'https://w/1' },
                { title: 'w2', url: 'https://w/2' },
                { title: 'w3', url: 'https://w/3' },
                { title: 'w4', url: 'https://w/4' },
            ])
        );
        const out = (await webSearchTool(
            { query: '금융위원회 발표', freshness: 'week' },
            ctx('ko'),
            rt
        )) as {
            source: string;
            results: Array<{ url: string; title: string; age: string | null }>;
        };
        expect(out.source).toBe('Naver News + Brave Search');
        expect(out.results.map(r => r.url)).toEqual([
            'https://gov.kr/a',
            'https://news.example/b',
            'https://w/1',
            'https://w/2',
            'https://w/3',
        ]);
        expect(out.results[0]).toMatchObject({
            title: '금융위 발표',
            age: '2026-09-13T00:00:00.000Z',
        });
        // freshness=week → recency sort on Naver; display share is 3.
        // The agent's own application key travels with every call — never the
        // news-ingestion key.
        expect(naver.search).toHaveBeenCalledWith(
            '금융위원회 발표',
            3,
            expect.stringContaining('web_search'),
            'date',
            expect.any(AbortSignal),
            AI_CREDS
        );
    });

    it('Naver throwing never takes a successful Brave result down', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        naver.creds = true;
        naver.search.mockRejectedValue(new Error('boom'));
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            braveResponse([{ title: 'w1', url: 'https://w/1' }])
        );
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const out = (await webSearchTool({ query: '금리' }, ctx('ko'), rt)) as {
            source: string;
            results: unknown[];
        };
        expect(out.source).toBe('Brave Search');
        expect(out.results).toHaveLength(1);
    });

    it('ko locale but no Hangul in the query → Naver is not asked (quota)', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        naver.creds = true;
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            braveResponse([{ title: 'sec', url: 'https://sec.gov/x' }])
        );
        await webSearchTool({ query: 'SEC 10-K NVDA' }, ctx('ko'), rt);
        expect(naver.search).not.toHaveBeenCalled();
    });

    it('Naver-only + non-Korean query → empty results labelled "none", never a provider name', async () => {
        naver.creds = true;
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('must not be called'));
        const out = (await webSearchTool(
            { query: 'fed minutes' },
            ctx('en'),
            rt
        )) as {
            source: string;
            results: unknown[];
        };
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(naver.search).not.toHaveBeenCalled();
        expect(out).toMatchObject({ source: 'none', results: [] });
    });

    it('a non-http originallink falls back to the Naver mirror link instead of dropping the hit', async () => {
        naver.creds = true;
        naver.search.mockResolvedValue([
            {
                title: 't',
                originallink: 'newsapp://article/1',
                link: 'https://n.news.naver.com/z',
                description: 'd',
            },
        ]);
        const out = (await webSearchTool({ query: '금리' }, ctx('ko'), rt)) as {
            results: Array<{ url: string }>;
        };
        expect(out.results.map(r => r.url)).toEqual([
            'https://n.news.naver.com/z',
        ]);
    });

    it('Korean query: Naver web documents sit between the news and Brave, deduped and capped', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        naver.creds = true;
        naver.search.mockResolvedValue(naverItems);
        naver.web.mockResolvedValue([
            {
                title: '<b>금융위</b> 보도자료',
                link: 'https://fsc.go.kr/p/1',
                description: 'gov <b>page</b>',
            },
            {
                title: 'dup of news',
                link: 'https://gov.kr/a',
                description: 'x',
            },
            { title: 'bad', link: 'ftp://nope', description: 'x' },
        ]);
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            braveResponse([
                { title: 'w1', url: 'https://w/1' },
                { title: 'w2', url: 'https://w/2' },
                { title: 'w3', url: 'https://w/3' },
            ])
        );
        const out = (await webSearchTool(
            { query: '금융위 보도자료' },
            ctx('ko'),
            rt
        )) as {
            source: string;
            results: Array<{ url: string; title: string; age: string | null }>;
        };
        expect(out.source).toBe('Naver News + Naver Web + Brave Search');
        expect(out.results.map(r => r.url)).toEqual([
            'https://gov.kr/a',
            'https://news.example/b',
            'https://fsc.go.kr/p/1',
            'https://w/1',
            'https://w/2',
        ]);
        expect(out.results[2]).toMatchObject({
            title: '금융위 보도자료',
            age: null,
        });
        expect(naver.web).toHaveBeenCalledWith(
            '금융위 보도자료',
            2,
            expect.stringContaining('web_search'),
            AI_CREDS,
            expect.any(AbortSignal)
        );
    });

    it('web documents returning nothing leaves news + Brave intact', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        naver.creds = true;
        naver.search.mockResolvedValue(naverItems);
        naver.web.mockResolvedValue([]);
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            braveResponse([{ title: 'w1', url: 'https://w/1' }])
        );
        const out = (await webSearchTool({ query: '금리' }, ctx('ko'), rt)) as {
            source: string;
            results: unknown[];
        };
        expect(out.source).toBe('Naver News + Brave Search');
        expect(out.results).toHaveLength(3);
    });

    it('Brave titles and snippets are cleaned of highlight markup before the model sees them', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    web: {
                        results: [
                            {
                                title: '<strong>NVDA</strong> news',
                                url: 'https://w/1',
                                description: 'Nvidia <strong>leads</strong> AI',
                            },
                        ],
                    },
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        );
        const out = (await webSearchTool(
            { query: 'NVDA news' },
            ctx('en'),
            rt
        )) as {
            results: Array<{ title: string; snippet: string }>;
        };
        expect(out.results[0]).toMatchObject({
            title: 'NVDA news',
            snippet: 'Nvidia leads AI',
        });
    });

    it('English query never calls Naver even with credentials; Brave only', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        naver.creds = true;
        naver.search.mockResolvedValue(naverItems);
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            braveResponse([{ title: 'sec', url: 'https://sec.gov/x' }])
        );
        const out = (await webSearchTool(
            { query: 'SEC 10-K NVDA' },
            ctx('en'),
            rt
        )) as { source: string; results: unknown[] };
        expect(naver.search).not.toHaveBeenCalled();
        expect(out.source).toBe('Brave Search');
        expect(out.results).toHaveLength(1);
    });

    it('Naver-only environment answers Korean queries without any Brave call', async () => {
        naver.creds = true;
        naver.search.mockResolvedValue(naverItems);
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('must not be called'));
        const out = (await webSearchTool(
            { query: '한은 금리' },
            ctx('en'),
            rt
        )) as {
            source: string;
            results: unknown[];
        };
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(out.source).toBe('Naver News');
        expect(out.results).toHaveLength(2);
        // Relevance sort by default (no freshness).
        expect(naver.search.mock.calls.at(-1)?.[3]).toBe('sim');
    });

    it('Brave failure with Naver hits still returns the Naver results', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        naver.creds = true;
        naver.search.mockResolvedValue(naverItems);
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('nope', { status: 429 })
        );
        const out = (await webSearchTool({ query: '금리' }, ctx('ko'), rt)) as {
            source: string;
            results: unknown[];
        };
        expect(out.source).toBe('Naver News');
        expect(out.results).toHaveLength(2);
    });

    it('Brave failure alone surfaces the error as before (status kept, timeout mapped)', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('nope', { status: 503 })
        );
        expect(await webSearchTool({ query: 'fed' }, ctx('en'), rt)).toEqual({
            error: 'search_failed',
            status: 503,
        });
        const abort = new Error('aborted');
        abort.name = 'AbortError';
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(abort);
        expect(await webSearchTool({ query: 'fed' }, ctx('en'), rt)).toEqual({
            error: 'timeout',
        });
    });
});

const naverNewsFive = Array.from({ length: 3 }, (_, i) => ({
    title: `뉴스 ${i}`,
    link: `https://news.example/${i}`,
    description: `요약 ${i}`,
    pubDate: 'Sat, 13 Sep 2026 09:00:00 +0900',
}));
const naverWebTwo = Array.from({ length: 2 }, (_, i) => ({
    title: `문서 ${i}`,
    link: `https://gov.example/${i}`,
    description: `설명 ${i}`,
}));

/** A rejecting default: a request nobody routed must never reach the network. */
function stubFetch(handler: (url: string) => Response | undefined) {
    const fetchMock = vi.fn(async (url: URL | string) => {
        const response = handler(String(url));
        if (response === undefined)
            throw new Error(`unrouted request: ${String(url)}`);
        return response;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}
const braveHost = 'api.search.brave.com';
const braveCalls = (fetchMock: ReturnType<typeof stubFetch>) =>
    fetchMock.mock.calls.filter(c => String(c[0]).includes(braveHost));

describe('web_search provider order and Brave metering', () => {
    beforeEach(() => {
        naver.creds = true;
        naver.search.mockReset();
        naver.web.mockReset();
        naver.search.mockResolvedValue(naverNewsFive);
        naver.web.mockResolvedValue(naverWebTwo);
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        __resetWebSearchCacheForTests();
        excerpt.fetch.mockReset();
        excerpt.fetch.mockResolvedValue({ ok: false, status: 'robots' });
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const braveOk = () =>
        braveResponse([
            { title: 'b1', url: 'https://w/1' },
            { title: 'b2', url: 'https://w/2' },
        ]);

    it('Korean query where Naver fills all five slots: no Brave request and no budget claim', async () => {
        const fetchMock = stubFetch(() => undefined);
        const claim = vi.fn(async () => ({ ok: true }));
        const out = (await webSearchTool(
            { query: '금리 전망' },
            ctx('ko', claim),
            rt
        )) as {
            source: string;
            results: unknown[];
        };
        expect(out.source).toBe('Naver News + Naver Web');
        expect(out.results).toHaveLength(5);
        expect(braveCalls(fetchMock)).toHaveLength(0);
        expect(claim).not.toHaveBeenCalled();
    });

    it('Korean query where Naver returns fewer than five: Brave fills, with exactly one claim made before the request', async () => {
        naver.web.mockResolvedValue([]);
        const order: string[] = [];
        const fetchMock = stubFetch(url => {
            order.push('fetch');
            return url.includes(braveHost) ? braveOk() : undefined;
        });
        const claim = vi.fn(async () => {
            order.push('claim');
            return { ok: true };
        });
        const out = (await webSearchTool(
            { query: '금리 전망' },
            ctx('ko', claim),
            rt
        )) as {
            source: string;
            results: unknown[];
        };
        expect(out.source).toBe('Naver News + Brave Search');
        expect(out.results).toHaveLength(5);
        expect(claim).toHaveBeenCalledTimes(1);
        expect(braveCalls(fetchMock)).toHaveLength(1);
        expect(order).toEqual(['claim', 'fetch']);
    });

    it('non-Korean query: Brave only, one claim, Naver untouched', async () => {
        const fetchMock = stubFetch(url =>
            url.includes(braveHost) ? braveOk() : undefined
        );
        const claim = vi.fn(async () => ({ ok: true }));
        await webSearchTool({ query: 'fed minutes' }, ctx('en', claim), rt);
        expect(claim).toHaveBeenCalledTimes(1);
        expect(braveCalls(fetchMock)).toHaveLength(1);
        expect(naver.search).not.toHaveBeenCalled();
        expect(naver.web).not.toHaveBeenCalled();
    });

    it('Korean query with Naver down: Brave answers', async () => {
        naver.search.mockRejectedValue(new Error('boom'));
        naver.web.mockRejectedValue(new Error('boom'));
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        stubFetch(url => (url.includes(braveHost) ? braveOk() : undefined));
        const out = (await webSearchTool(
            { query: '금리 전망' },
            ctx('ko'),
            rt
        )) as {
            source: string;
        };
        expect(out.source).toBe('Brave Search');
    });

    it('a refused claim with no Naver hits returns the refusal and sends no Brave request', async () => {
        naver.search.mockResolvedValue([]);
        naver.web.mockResolvedValue([]);
        const fetchMock = stubFetch(() => undefined);
        const refusal = { error: 'quota', scope: 'global_day' };
        const claim = vi.fn(async () => ({ ok: false, refusal }));
        expect(
            await webSearchTool({ query: '금리 전망' }, ctx('ko', claim), rt)
        ).toEqual(refusal);
        expect(braveCalls(fetchMock)).toHaveLength(0);
    });

    it('a refused claim with Naver hits returns them without Brave, and does not cache the degraded answer', async () => {
        naver.web.mockResolvedValue([]);
        const fetchMock = stubFetch(url =>
            url.includes(braveHost) ? braveOk() : undefined
        );
        const claim = vi
            .fn<() => Promise<unknown>>()
            .mockResolvedValueOnce({
                ok: false,
                refusal: { error: 'quota', scope: 'global_month' },
            })
            .mockResolvedValue({ ok: true });
        const first = (await webSearchTool(
            { query: '금리 전망' },
            ctx('ko', claim),
            rt
        )) as {
            source: string;
            results: unknown[];
            cached?: boolean;
        };
        expect(first.source).toBe('Naver News');
        expect(first.results).toHaveLength(3);
        expect(braveCalls(fetchMock)).toHaveLength(0);
        // The refusal was transient: the same query tries Brave again instead of replaying the Naver-only answer.
        const second = (await webSearchTool(
            { query: '금리 전망' },
            ctx('ko', claim),
            rt
        )) as {
            source: string;
            cached?: boolean;
        };
        expect(second.cached).toBeUndefined();
        expect(second.source).toBe('Naver News + Brave Search');
        expect(braveCalls(fetchMock)).toHaveLength(1);
    });

    it('works without a claim function (gate mode): Brave is called and nothing throws', async () => {
        const fetchMock = stubFetch(url =>
            url.includes(braveHost) ? braveOk() : undefined
        );
        const out = (await webSearchTool(
            { query: 'fed minutes' },
            ctx('en'),
            rt
        )) as {
            results: unknown[];
        };
        expect(out.results).toHaveLength(2);
        expect(braveCalls(fetchMock)).toHaveLength(1);
    });

    it('spends no claim on a missing key, an out-of-scope query or a cache hit', async () => {
        const claim = vi.fn(async () => ({ ok: true }));
        vi.stubEnv('BRAVE_SEARCH_API_KEY', '');
        naver.creds = false;
        expect(
            await webSearchTool({ query: 'fed' }, ctx('en', claim), rt)
        ).toEqual({
            error: 'unavailable',
        });
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        expect(
            await webSearchTool(
                { query: 'site:github.com x' },
                ctx('en', claim),
                rt
            )
        ).toEqual({ error: 'out_of_scope' });
        expect(claim).not.toHaveBeenCalled();

        stubFetch(url => (url.includes(braveHost) ? braveOk() : undefined));
        await webSearchTool({ query: 'fed minutes' }, ctx('en', claim), rt);
        await webSearchTool({ query: 'fed minutes' }, ctx('en', claim), rt);
        expect(claim).toHaveBeenCalledTimes(1);
    });
});

describe('web_search transient cache', () => {
    beforeEach(() => {
        naver.creds = false;
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        __resetWebSearchCacheForTests();
        excerpt.fetch.mockReset();
        excerpt.fetch.mockResolvedValue({ ok: false, status: 'robots' });
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const braveOne = () =>
        braveResponse([{ title: 'sec', url: 'https://sec.gov/x' }]);

    it('a repeated query is served from memory with cached:true and its original asOf, with no request', async () => {
        const fetchMock = stubFetch(() => braveOne());
        const first = (await webSearchTool(
            { query: 'fed minutes' },
            ctx('en'),
            rt
        )) as {
            asOf: string;
            cached?: boolean;
        };
        expect(first.cached).toBeUndefined();
        const second = (await webSearchTool(
            { query: '  FED   Minutes ' },
            ctx('en'),
            rt
        )) as {
            asOf: string;
            cached?: boolean;
            results: unknown[];
        };
        expect(second.cached).toBe(true);
        expect(second.asOf).toBe(first.asOf);
        expect(second.results).toHaveLength(1);
        expect(braveCalls(fetchMock)).toHaveLength(1);
        expect(excerpt.fetch).toHaveBeenCalledTimes(1);
    });

    it('near-miss keys are not served from the cache (freshness, search language)', async () => {
        const fetchMock = stubFetch(() => braveOne());
        await webSearchTool({ query: 'fed minutes' }, ctx('en'), rt);
        await webSearchTool(
            { query: 'fed minutes', freshness: 'week' },
            ctx('en'),
            rt
        );
        await webSearchTool({ query: 'fed minutes' }, ctx('ko'), rt);
        expect(braveCalls(fetchMock)).toHaveLength(3);
    });

    it('expires after 15 minutes, and after 5 minutes for freshness=day', async () => {
        vi.useFakeTimers();
        const fetchMock = stubFetch(() => braveOne());
        const run = (args: Record<string, unknown>) =>
            webSearchTool(args, ctx('en'), rt);
        await run({ query: 'normal' });
        await run({ query: 'daily', freshness: 'day' });
        await vi.advanceTimersByTimeAsync(5 * 60_000 + 1);
        await run({ query: 'normal' });
        await run({ query: 'daily', freshness: 'day' });
        // `normal` was still cached at 5 minutes; `daily` was not.
        expect(braveCalls(fetchMock)).toHaveLength(3);
        await vi.advanceTimersByTimeAsync(10 * 60_000);
        await run({ query: 'normal' });
        expect(braveCalls(fetchMock)).toHaveLength(4);
    });

    it('never caches an error, so the next call retries', async () => {
        const fetchMock = stubFetch(
            () => new Response('nope', { status: 503 })
        );
        expect(await webSearchTool({ query: 'fed' }, ctx('en'), rt)).toEqual({
            error: 'search_failed',
            status: 503,
        });
        fetchMock.mockImplementation(async () => braveOne());
        const out = (await webSearchTool({ query: 'fed' }, ctx('en'), rt)) as {
            results: unknown[];
        };
        expect(out.results).toHaveLength(1);
        expect(braveCalls(fetchMock)).toHaveLength(2);
    });

    it('does not cache a Naver-only answer produced because Brave failed', async () => {
        naver.creds = true;
        naver.search.mockResolvedValue(naverNewsFive);
        naver.web.mockResolvedValue([]);
        const fetchMock = stubFetch(
            () => new Response('nope', { status: 429 })
        );
        await webSearchTool({ query: '금리 전망' }, ctx('ko'), rt);
        await webSearchTool({ query: '금리 전망' }, ctx('ko'), rt);
        expect(braveCalls(fetchMock)).toHaveLength(2);
    });

    it('does not cache a result produced by a turn that was aborted mid-search', async () => {
        const turn = new AbortController();
        const fetchMock = stubFetch(() => {
            turn.abort();
            return braveOne();
        });
        const abortedCtx = {
            locale: 'en',
            signal: turn.signal,
            userId: 'u',
        } as never;
        await webSearchTool({ query: 'fed minutes' }, abortedCtx, rt);
        const again = (await webSearchTool(
            { query: 'fed minutes' },
            ctx('en'),
            rt
        )) as {
            cached?: boolean;
        };
        expect(again.cached).toBeUndefined();
        expect(braveCalls(fetchMock)).toHaveLength(2);
    });

    it.each(['timeout', 'error'])(
        'does not cache a result when a page read ended on %s',
        async status => {
            const fetchMock = stubFetch(() => braveOne());
            excerpt.fetch.mockResolvedValue({ ok: false, status });
            await webSearchTool({ query: 'fed minutes' }, ctx('en'), rt);
            await webSearchTool({ query: 'fed minutes' }, ctx('en'), rt);
            expect(braveCalls(fetchMock)).toHaveLength(2);
        }
    );

    it.each(['robots', 'not_html', 'too_large', 'blocked'])(
        'still caches a result when a page read ended on %s (a property of the page)',
        async status => {
            const fetchMock = stubFetch(() => braveOne());
            excerpt.fetch.mockResolvedValue({ ok: false, status });
            await webSearchTool({ query: 'fed minutes' }, ctx('en'), rt);
            const second = (await webSearchTool(
                { query: 'fed minutes' },
                ctx('en'),
                rt
            )) as {
                cached?: boolean;
            };
            expect(second.cached).toBe(true);
            expect(braveCalls(fetchMock)).toHaveLength(1);
        }
    );

    it('a live waiter that receives a degraded shared value runs its own search once', async () => {
        const turn = new AbortController();
        const release: Array<() => void> = [];
        const fetchMock = vi
            .fn<(url: string) => Promise<Response>>()
            .mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        release.push(() => resolve(braveOne()));
                    })
            )
            .mockImplementation(async () => braveOne());
        vi.stubGlobal('fetch', fetchMock);
        const ownerCtx = {
            locale: 'en',
            signal: turn.signal,
            userId: 'u',
        } as never;
        const owner = webSearchTool({ query: 'fed minutes' }, ownerCtx, rt);
        const waiter = webSearchTool({ query: 'fed minutes' }, ctx('en'), rt);
        await vi.waitFor(() => expect(release).toHaveLength(1));
        turn.abort();
        release[0]();
        const [, waiterOut] = (await Promise.all([owner, waiter])) as Array<{
            results: unknown[];
            cached?: boolean;
        }>;
        expect(waiterOut.results).toHaveLength(1);
        expect(waiterOut.cached).toBeUndefined();
        expect(braveCalls(fetchMock as never)).toHaveLength(2);
    });

    it('an aborted waiter does not retry', async () => {
        const turn = new AbortController();
        const release: Array<() => void> = [];
        const fetchMock = vi
            .fn<(url: string) => Promise<Response>>()
            .mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        release.push(() =>
                            resolve(new Response('x', { status: 500 }))
                        );
                    })
            )
            .mockImplementation(async () => braveOne());
        vi.stubGlobal('fetch', fetchMock);
        const owner = webSearchTool({ query: 'fed minutes' }, ctx('en'), rt);
        const waiter = webSearchTool(
            { query: 'fed minutes' },
            { locale: 'en', signal: turn.signal, userId: 'u' } as never,
            rt
        );
        await vi.waitFor(() => expect(release).toHaveLength(1));
        turn.abort();
        release[0]();
        await Promise.all([owner, waiter]);
        expect(braveCalls(fetchMock as never)).toHaveLength(1);
    });

    it('identical parallel calls share one provider round trip', async () => {
        const fetchMock = stubFetch(() => braveOne());
        const claim = vi.fn(async () => ({ ok: true }));
        const [a, b] = (await Promise.all([
            webSearchTool({ query: 'fed minutes' }, ctx('en', claim), rt),
            webSearchTool({ query: 'fed minutes' }, ctx('en', claim), rt),
        ])) as Array<{ cached?: boolean; results: unknown[] }>;
        expect(braveCalls(fetchMock)).toHaveLength(1);
        expect(claim).toHaveBeenCalledTimes(1);
        expect(a.results).toEqual(b.results);
        expect([a.cached, b.cached].filter(Boolean)).toHaveLength(1);
    });
});

describe('web_search page excerpts', () => {
    beforeEach(() => {
        naver.creds = false;
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        __resetWebSearchCacheForTests();
        excerpt.fetch.mockReset();
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const results = [
        { title: 'tweet', url: 'https://x.com/a/status/1' },
        { title: 'report', url: 'https://example.com/report.pdf' },
        { title: 'one', url: 'https://one.example.com/a' },
        { title: 'video', url: 'https://www.youtube.com/watch?v=1' },
        { title: 'two', url: 'https://two.example.com/b' },
    ];
    type Item = {
        url: string;
        excerpt?: string;
        excerptStatus?: string;
        publishedAt?: string;
    };

    it('reads the first two readable results only, skipping social hosts and PDFs', async () => {
        stubFetch(() => braveResponse(results));
        excerpt.fetch.mockImplementation(async url => ({
            ok: true,
            excerpt: `text of ${url}`,
            publishedAt: null,
        }));
        const out = (await webSearchTool(
            { query: 'fed minutes' },
            ctx('en'),
            rt
        )) as {
            results: Item[];
        };
        const asked = excerpt.fetch.mock.calls.map(c => c[0]).sort();
        expect(asked).toEqual([
            'https://one.example.com/a',
            'https://two.example.com/b',
        ]);
        const byUrl = (url: string) => out.results.find(r => r.url === url);
        expect(byUrl('https://one.example.com/a')?.excerpt).toBe(
            'text of https://one.example.com/a'
        );
        expect(byUrl('https://x.com/a/status/1')).not.toHaveProperty('excerpt');
        expect(byUrl('https://x.com/a/status/1')).not.toHaveProperty(
            'excerptStatus'
        );
        expect(byUrl('https://example.com/report.pdf')).not.toHaveProperty(
            'excerpt'
        );
    });

    it('passes the query terms, the turn signal and a page budget of at most 3.5 s', async () => {
        stubFetch(() => braveResponse(results));
        excerpt.fetch.mockResolvedValue({ ok: false, status: 'robots' });
        await webSearchTool({ query: 'NVDA earnings' }, ctx('en'), rt);
        const call = excerpt.fetch.mock.calls.find(
            c => c[0] === 'https://one.example.com/a'
        );
        expect(call?.[1]).toEqual(expect.arrayContaining(['nvda', 'earnings']));
        expect(call?.[2]).toBeInstanceOf(AbortSignal);
        expect(call?.[3]).toBeLessThanOrEqual(3_500);
        expect(call?.[3]).toBeGreaterThanOrEqual(1_000);
    });

    it('attaches publishedAt when the page has one, and excerptStatus when it could not be read', async () => {
        stubFetch(() => braveResponse(results));
        excerpt.fetch.mockImplementation(async url =>
            url === 'https://one.example.com/a'
                ? {
                      ok: true,
                      excerpt: 'body',
                      publishedAt: '2026-11-20T00:00:00.000Z',
                  }
                : { ok: false, status: 'timeout' }
        );
        const out = (await webSearchTool(
            { query: 'fed minutes' },
            ctx('en'),
            rt
        )) as {
            results: Item[];
        };
        const one = out.results.find(
            r => r.url === 'https://one.example.com/a'
        );
        const two = out.results.find(
            r => r.url === 'https://two.example.com/b'
        );
        expect(one).toMatchObject({
            excerpt: 'body',
            publishedAt: '2026-11-20T00:00:00.000Z',
        });
        expect(one).not.toHaveProperty('excerptStatus');
        expect(two).toMatchObject({ excerptStatus: 'timeout' });
        expect(two).not.toHaveProperty('excerpt');
        expect(two).not.toHaveProperty('publishedAt');
    });

    it('skips the page phase when slow providers leave under one second', async () => {
        vi.useFakeTimers();
        naver.creds = true;
        naver.search.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve([]), 4_000))
        );
        naver.web.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve([]), 4_000))
        );
        const fetchMock = vi.fn(
            () =>
                new Promise<Response>(resolve =>
                    setTimeout(() => resolve(braveResponse(results)), 8_500)
                )
        );
        vi.stubGlobal('fetch', fetchMock);
        const pending = webSearchTool({ query: '금리 전망' }, ctx('ko'), rt);
        await vi.advanceTimersByTimeAsync(12_600);
        const out = (await pending) as { results: Item[] };
        expect(out.results.length).toBeGreaterThan(0);
        expect(excerpt.fetch).not.toHaveBeenCalled();
        expect(out.results.every(r => r.excerptStatus === undefined)).toBe(
            true
        );
    });

    it('hands the page phase only what is left of the 13 s deadline', async () => {
        vi.useFakeTimers();
        naver.creds = true;
        naver.search.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve([]), 4_000))
        );
        naver.web.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve([]), 4_000))
        );
        stubFetchAfter(6_000);
        excerpt.fetch.mockResolvedValue({ ok: false, status: 'timeout' });
        const pending = webSearchTool({ query: '금리 전망' }, ctx('ko'), rt);
        await vi.advanceTimersByTimeAsync(10_000);
        await pending;
        // 4 s Naver + 6 s Brave leaves 3 s; minus the 0.3 s margin.
        expect(excerpt.fetch.mock.calls.map(c => c[3])).toEqual([2_700, 2_700]);
    });

    function stubFetchAfter(delayMs: number) {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                () =>
                    new Promise<Response>(resolve =>
                        setTimeout(
                            () => resolve(braveResponse(results)),
                            delayMs
                        )
                    )
            )
        );
    }
});

describe('web_search size and telemetry', () => {
    beforeEach(() => {
        naver.creds = false;
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        __resetWebSearchCacheForTests();
        excerpt.fetch.mockReset();
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const heavy = (n: number) => {
        const unit = 'abcdefgh"ij\n';
        return unit.repeat(Math.ceil(n / unit.length)).slice(0, n);
    };

    it('clips titles and snippets to 400 chars and drops URLs over 500 chars', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        excerpt.fetch.mockResolvedValue({ ok: false, status: 'robots' });
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            web: {
                                results: [
                                    {
                                        title: 'T'.repeat(900),
                                        url: 'https://a.example.com/ok',
                                        description: 'S'.repeat(900),
                                    },
                                    {
                                        title: 'long url',
                                        url: `https://a.example.com/${'p'.repeat(600)}`,
                                        description: 'x',
                                    },
                                ],
                            },
                        }),
                        { status: 200 }
                    )
            )
        );
        const out = (await webSearchTool(
            { query: 'clip me' },
            ctx('en'),
            rt
        )) as {
            results: Array<{ title: string; snippet: string; url: string }>;
        };
        expect(out.results).toHaveLength(1);
        expect(out.results[0].title).toHaveLength(400);
        expect(out.results[0].snippet).toHaveLength(400);
    });

    it('the heaviest possible result fits WEB_SEARCH_RESULT_MAX_CHARS with headroom', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        excerpt.fetch.mockResolvedValue({
            ok: true,
            excerpt: heavy(1_800),
            publishedAt: '2026-11-22T00:00:00.000Z',
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            web: {
                                results: Array.from({ length: 5 }, (_, i) => ({
                                    title: heavy(400),
                                    url: `https://h${i}.example.com/${'a'.repeat(470)}`,
                                    description: heavy(400),
                                    age: '2026-11-22T00:00:00.000Z',
                                })),
                            },
                        }),
                        { status: 200 }
                    )
            )
        );
        const first = await webSearchTool(
            { query: 'worst case' },
            ctx('en'),
            rt
        );
        const cachedHit = await webSearchTool(
            { query: 'worst case' },
            ctx('en'),
            rt
        );
        const size = JSON.stringify(cachedHit).length;
        expect(JSON.stringify(first).length).toBeLessThanOrEqual(size);
        // Measured ~11,900 on this fixture; the ceiling is ~9% above it.
        expect(size).toBeGreaterThan(11_000);
        expect(size).toBeLessThan(WEB_SEARCH_RESULT_MAX_CHARS);
    });

    it('logs one JSON line per call: counts and outcomes, never the query text or a URL', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        naver.creds = true;
        naver.search.mockResolvedValue(naverNewsFive);
        naver.web.mockResolvedValue([]);
        excerpt.fetch.mockImplementation(async url =>
            url === 'https://news.example/0'
                ? { ok: true, excerpt: 'body', publishedAt: null }
                : { ok: false, status: 'robots' }
        );
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                braveResponse([
                    { title: 'b1', url: 'https://w/1' },
                    { title: 'b2', url: 'https://w/2' },
                ])
            )
        );
        const query = '비밀스러운 질의 문구';
        await webSearchTool({ query }, ctx('ko'), rt);
        await webSearchTool({ query }, ctx('ko'), rt);
        const lines = info.mock.calls.map(c => String(c[0]));
        expect(lines).toHaveLength(2);
        for (const line of lines) {
            expect(line).not.toContain('\n');
            expect(line).not.toContain(query);
            expect(line).not.toContain('http');
        }
        const [miss, hit] = lines.map(
            l => JSON.parse(l) as Record<string, unknown>
        );
        expect(miss).toMatchObject({
            tag: '[AgentTool] web_search',
            korean: true,
            cache: 'miss',
            brave: 'called',
            naverHits: 3,
            braveHits: 2,
            excerpts: 1,
            excerptFailures: { robots: 1 },
        });
        expect(typeof miss.ms).toBe('number');
        expect(hit).toMatchObject({
            cache: 'hit',
            brave: 'skipped',
            korean: true,
        });
    });

    it('logs a refused Brave claim and a failed Brave request', async () => {
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('x', { status: 500 }))
        );
        const refusal = { error: 'unavailable' };
        await webSearchTool(
            { query: 'one' },
            ctx('en', async () => ({ ok: false, refusal })),
            rt
        );
        await webSearchTool({ query: 'two' }, ctx('en'), rt);
        const parsed = info.mock.calls.map(
            c => JSON.parse(String(c[0])) as { brave: string }
        );
        expect(parsed.map(p => p.brave)).toEqual(['refused', 'failed']);
    });
});
