import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchNaverNews } from '@/entities/news-article/lib/naverNewsSearch';

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
            '금리',
            expect.anything()
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
