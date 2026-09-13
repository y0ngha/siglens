import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const AI_CREDS = { id: 'ai-id', secret: 'ai-secret' };
vi.mock('@/entities/news-article/api', () => ({
    naverAiCredentials: () => (naver.creds ? AI_CREDS : null),
    searchNaverNews: naver.search,
    searchNaverWeb: naver.web,
    stripNaverMarkup: (s: string) => s.replace(/<[^>]*>/g, ''),
    toIsoPublishedAt: (d?: string) => (d ? new Date(d).toISOString() : null),
}));

import { webSearchTool } from '@/app/api/ai/chat/tools/webSearch';

const rt = {} as never;
const ctx = (locale: 'ko' | 'en') =>
    ({
        locale,
        signal: new AbortController().signal,
        userId: 'u',
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
