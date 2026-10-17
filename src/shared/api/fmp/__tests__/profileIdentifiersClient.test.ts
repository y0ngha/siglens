vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFmpProfileIdentifiers } from '../profileIdentifiersClient';

const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('FMP_API_KEY', 'test-key');
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

const ok = (body: unknown): Response =>
    new Response(JSON.stringify(body), { status: 200 });

describe('fetchFmpProfileIdentifiers', () => {
    it('extracts cusip, isin and the ETF/fund flags (real AAPL profile fields)', async () => {
        fetchSpy.mockResolvedValueOnce(
            ok([
                {
                    symbol: 'AAPL',
                    cusip: '037833100',
                    isin: 'US0378331005',
                    isEtf: false,
                    isFund: false,
                    price: 342.96,
                },
            ])
        );
        expect(await fetchFmpProfileIdentifiers('AAPL')).toEqual({
            cusip: '037833100',
            isin: 'US0378331005',
            isEtf: false,
            isFund: false,
        });
        expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
            '/stable/profile?symbol=AAPL'
        );
    });

    it('flags ETFs (SPY)', async () => {
        fetchSpy.mockResolvedValueOnce(
            ok([
                {
                    cusip: '78462F103',
                    isin: 'US78462F1030',
                    isEtf: true,
                    isFund: false,
                },
            ])
        );
        expect((await fetchFmpProfileIdentifiers('SPY'))?.isEtf).toBe(true);
    });

    it('maps missing fields to null / false', async () => {
        fetchSpy.mockResolvedValueOnce(ok([{ symbol: 'X' }]));
        expect(await fetchFmpProfileIdentifiers('X')).toEqual({
            cusip: null,
            isin: null,
            isEtf: false,
            isFund: false,
        });
    });

    it('returns null for an empty profile list (distinct from a failure)', async () => {
        fetchSpy.mockResolvedValueOnce(ok([]));
        expect(await fetchFmpProfileIdentifiers('GONE')).toBeNull();
    });

    it('propagates FMP errors', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('', { status: 402 }));
        await expect(fetchFmpProfileIdentifiers('BAD')).rejects.toMatchObject({
            status: 402,
        });
    });

    it('passes retryTransient: false through so a 5xx is a single HTTP attempt', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('', { status: 503 }));
        await expect(
            fetchFmpProfileIdentifiers('AAPL', { retryTransient: false })
        ).rejects.toThrow();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});
