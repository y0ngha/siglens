vi.mock('@y0ngha/siglens-core', () => ({
    readFmpConfig: vi.fn(() => ({ apiKey: 'test-key' })),
}));

import { fmpGet, FMP_STABLE_BASE } from '@/shared/api/fmp/httpClient';

describe('FMP API error responses', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('throws on 429 rate limit', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(null, { status: 429, statusText: 'Too Many Requests' })
        );

        await expect(fmpGet('news/stock', { symbols: 'AAPL' })).rejects.toThrow(
            'FMP news/stock 429'
        );
    });

    it('throws on 500 internal server error', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(null, { status: 500 })
        );

        await expect(fmpGet('earnings', { symbol: 'AAPL' })).rejects.toThrow(
            'FMP earnings 500'
        );
    });

    it('throws on network timeout (AbortSignal)', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new DOMException('The operation was aborted', 'AbortError')
        );

        await expect(fmpGet('news/stock')).rejects.toThrow('aborted');
    });

    it('constructs correct URL with params', async () => {
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

    it('parses JSON response on success', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify([{ id: 1 }]), { status: 200 })
        );

        const result = await fmpGet<{ id: number }[]>('test');

        expect(result).toEqual([{ id: 1 }]);
    });
});
