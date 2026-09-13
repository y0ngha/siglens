import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    naverAiCredentials,
    searchNaverNews,
    searchNaverWeb,
} from '@/entities/news-article/lib/naverNewsSearch';

describe('searchNaverNews — never throws', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('a 200 with a non-JSON body degrades to [] instead of rejecting', async () => {
        vi.stubEnv('NAVER_CLIENT_ID', 'id');
        vi.stubEnv('NAVER_CLIENT_SECRET', 'secret');
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('<html>gateway</html>', {
                status: 200,
                headers: { 'content-type': 'text/html' },
            })
        );
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(searchNaverNews('금리', 3, '[test]')).resolves.toEqual([]);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('malformed JSON body'),
            '금리'
        );
    });

    it('combines the caller signal with its own timeout: an already-aborted signal short-circuits to []', async () => {
        vi.stubEnv('NAVER_CLIENT_ID', 'id');
        vi.stubEnv('NAVER_CLIENT_SECRET', 'secret');
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    const s = (init as RequestInit).signal!;
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    if (s.aborted) reject(err);
                    s.addEventListener('abort', () => reject(err));
                })
        );
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const controller = new AbortController();
        controller.abort();
        await expect(
            searchNaverNews('금리', 3, '[test]', 'sim', controller.signal)
        ).resolves.toEqual([]);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});

describe('searchNaverWeb (webkr) — agent application key', () => {
    const CREDS = { id: 'ai-id', secret: 'ai-secret' };
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('naverAiCredentials reads NAVER_AI_CLIENT_* only, never the news key', () => {
        vi.stubEnv('NAVER_CLIENT_ID', 'news');
        vi.stubEnv('NAVER_CLIENT_SECRET', 'news-secret');
        expect(naverAiCredentials()).toBeNull();
        vi.stubEnv('NAVER_AI_CLIENT_ID', 'ai');
        vi.stubEnv('NAVER_AI_CLIENT_SECRET', 'ai-secret');
        expect(naverAiCredentials()).toEqual({ id: 'ai', secret: 'ai-secret' });
    });

    it('parses items from the webkr endpoint, sending the given application key', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    items: [
                        { title: 't', link: 'https://x/1', description: 'd' },
                    ],
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        );
        await expect(
            searchNaverWeb('금리', 2, '[test]', CREDS)
        ).resolves.toEqual([
            { title: 't', link: 'https://x/1', description: 'd' },
        ]);
        const [url, init] = fetchSpy.mock.calls[0]!;
        expect(String(url)).toContain('/search/v1/webkr?');
        expect(String(url)).toContain('display=2');
        expect((init as RequestInit).headers).toMatchObject({
            'X-NCP-APIGW-API-KEY-ID': 'ai-id',
            'X-NCP-APIGW-API-KEY': 'ai-secret',
        });
    });

    it('non-OK → [] with a warn that does NOT match the news alarm filter', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('{"error":{}}', { status: 401 })
        );
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(
            searchNaverWeb('금리', 2, '[test]', CREDS)
        ).resolves.toEqual([]);
        expect(error).not.toHaveBeenCalled();
        const logged = warn.mock.calls.map(c => String(c[0])).join('\n');
        expect(logged).toContain('webkr request rejected');
        expect(logged).not.toContain('non-OK response');
    });

    it('news search with an override key uses that key instead of NAVER_CLIENT_*', async () => {
        vi.stubEnv('NAVER_CLIENT_ID', 'news');
        vi.stubEnv('NAVER_CLIENT_SECRET', 'news-secret');
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ items: [] }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        );
        await searchNaverNews('금리', 1, '[test]', 'sim', undefined, CREDS);
        expect(
            (fetchSpy.mock.calls[0]![1] as RequestInit).headers
        ).toMatchObject({
            'X-NCP-APIGW-API-KEY-ID': 'ai-id',
        });
    });
});
