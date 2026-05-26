// `sleep` is the only side-effect inside `withRetry`. Stubbing it prevents
// real wall-clock delays and keeps tests synchronous.
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@y0ngha/siglens-core', () => ({
    readFmpConfig: vi.fn(() => ({ apiKey: 'test-key' })),
}));

import { fmpGet, FMP_STABLE_BASE } from '@/shared/api/fmp/httpClient';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';

describe('FMP API error responses', () => {
    beforeEach(() => {
        // Deterministic jitter so delay assertions can be exact.
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('429 rate limit: maxRetries=3 이므로 fetch가 4번 호출된다', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(null, {
                status: 429,
                statusText: 'Too Many Requests',
            })
        );

        await expect(fmpGet('news/stock', { symbols: 'AAPL' })).rejects.toThrow(
            'FMP news/stock 429'
        );

        // initial attempt + 3 retries = 4 total
        expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('429 rate limit 소진 시 FmpHttpError를 던진다', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(null, {
                status: 429,
                statusText: 'Too Many Requests',
            })
        );

        const error = await fmpGet('news/stock', { symbols: 'AAPL' }).catch(
            (e: unknown) => e
        );
        expect(error).toBeInstanceOf(FmpHttpError);
    });

    it('500 server error: fetch가 4번 호출되고 FmpHttpError를 던진다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response(null, { status: 500 }));

        await expect(fmpGet('earnings', { symbol: 'AAPL' })).rejects.toThrow(
            'FMP earnings 500'
        );

        expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('network timeout (DOMException): 재시도 후 결국 던진다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(
                new DOMException('The operation was aborted', 'AbortError')
            );

        await expect(fmpGet('news/stock')).rejects.toThrow(DOMException);
        expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('429 followed by success on retry: 결과를 반환하고 fetch가 2번 호출된다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 429,
                    statusText: 'Too Many Requests',
                })
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify([{ id: 1 }]), { status: 200 })
            );

        const result = await fmpGet<{ id: number }[]>('news/stock', {
            symbols: 'AAPL',
        });

        expect(result).toEqual([{ id: 1 }]);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('올바른 URL과 쿼리 파라미터로 fetch를 호출한다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                new Response(JSON.stringify([]), { status: 200 })
            );

        await fmpGet('news/stock', { symbols: 'AAPL', limit: '30' });

        const calledUrl = fetchSpy.mock.calls[0][0] as string;
        expect(calledUrl).toContain(`${FMP_STABLE_BASE}/news/stock?`);
        expect(calledUrl).toContain('symbols=AAPL');
        expect(calledUrl).toContain('limit=30');
        expect(calledUrl).toContain('apikey=test-key');
    });

    it('성공 응답의 JSON을 파싱해서 반환한다', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify([{ id: 1 }]), { status: 200 })
        );

        const result = await fmpGet<{ id: number }[]>('test');

        expect(result).toEqual([{ id: 1 }]);
    });
});
