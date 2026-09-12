import { afterEach, describe, expect, it, vi } from 'vitest';
import { webSearchTool } from '@/app/api/ai/chat/tools/webSearch';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe('webSearchTool', () => {
    it('Brave에 q·count·freshness·search_lang, 상위 5건 스니펫만 반환', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({
                web: {
                    results: Array.from({ length: 8 }, (_, i) => ({
                        title: `t${i}`,
                        url: `https://x/${i}`,
                        description: `d${i}`,
                        age: '1 day ago',
                    })),
                },
            })
        );
        const r = (await webSearchTool(
            { query: 'Apple earnings', freshness: 'week' },
            ctx,
            rt
        )) as { results: unknown[] };

        const url = new URL(String(fetchMock.mock.calls[0]![0]));
        expect(url.origin + url.pathname).toBe(
            'https://api.search.brave.com/res/v1/web/search'
        );
        expect(url.searchParams.get('q')).toBe('Apple earnings');
        expect(url.searchParams.get('count')).toBe('5');
        expect(url.searchParams.get('freshness')).toBe('pw');
        expect(url.searchParams.get('search_lang')).toBe('ko');
        expect(
            (fetchMock.mock.calls[0]![1] as RequestInit).headers
        ).toMatchObject({ 'X-Subscription-Token': 'b' });
        expect(r.results).toHaveLength(5);
        expect(r.results[0]).toEqual({
            title: 't0',
            url: 'https://x/0',
            snippet: 'd0',
            age: '1 day ago',
        });
    });

    it('키가 없으면 fetch 없이 unavailable', async () => {
        // `mockImplementation` (not a bare spy) so that even if the
        // production guard regresses, this never dials the real Brave API —
        // a real call costs money.
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('must not be called'));
        expect(await webSearchTool({ query: 'q' }, ctx, rt)).toEqual({
            error: 'unavailable',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('비 2xx → search_failed', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('x', { status: 429 })
        );
        expect(await webSearchTool({ query: 'q' }, ctx, rt)).toEqual({
            error: 'search_failed',
            status: 429,
        });
    });

    it('타임아웃 → timeout, 절대 throw하지 않는다', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        vi.spyOn(globalThis, 'fetch').mockImplementation(
            (_input, init) =>
                new Promise((_resolve, reject) => {
                    const signal = (init as RequestInit).signal;
                    signal?.addEventListener('abort', () => {
                        const reason =
                            (signal as AbortSignal).reason ??
                            new DOMException('aborted', 'AbortError');
                        reject(reason);
                    });
                })
        );
        // Never-resolving fetch + a same-tick abort stands in for the real
        // `AbortSignal.timeout` firing, without waiting 8s in the test.
        await expect(
            (async () => {
                const controller = new AbortController();
                const result = webSearchTool(
                    { query: 'q' },
                    { ...ctx, signal: controller.signal },
                    rt
                );
                controller.abort(new DOMException('aborted', 'AbortError'));
                return result;
            })()
        ).resolves.toEqual({ error: 'timeout' });
    });

    it('URL은 http/https만 허용한다', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({
                web: {
                    results: [
                        { title: 'ok', url: 'https://x/0', description: 'd' },
                        {
                            title: 'bad',
                            url: 'javascript:alert(1)',
                            description: 'd',
                        },
                    ],
                },
            })
        );
        const r = (await webSearchTool({ query: 'q' }, ctx, rt)) as {
            results: { url: string }[];
        };
        expect(r.results).toHaveLength(1);
        expect(r.results[0]!.url).toBe('https://x/0');
    });

    it('200이지만 JSON이 아닌 본문(HTML 에러 페이지 등) → search_failed, 절대 throw하지 않는다', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('<html>not json</html>', {
                status: 200,
                headers: { 'content-type': 'text/html' },
            })
        );
        await expect(webSearchTool({ query: 'q' }, ctx, rt)).resolves.toEqual({
            error: 'search_failed',
        });
    });

    it('query 길이를 상한으로 자른다', async () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(Response.json({ web: { results: [] } }));
        await webSearchTool({ query: 'x'.repeat(1_000) }, ctx, rt);
        const url = new URL(String(fetchMock.mock.calls[0]![0]));
        expect(url.searchParams.get('q')!.length).toBeLessThanOrEqual(400);
    });
});
