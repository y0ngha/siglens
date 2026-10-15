import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sleep } from '@/shared/lib/sleep';
import {
    mapCusipsToTickers,
    OpenFigiRateLimitedError,
} from '../openFigiClient';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn(async () => undefined) }));

const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);
const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status });

const cusips = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => String(i).padStart(9, '0'));
const bodyOf = (callIndex: number): { idType: string; idValue: string }[] =>
    JSON.parse(
        (fetchSpy.mock.calls[callIndex]?.[1] as RequestInit).body as string
    );
const headersOf = (callIndex: number): Record<string, string> =>
    (fetchSpy.mock.calls[callIndex]?.[1] as RequestInit).headers as Record<
        string,
        string
    >;

beforeEach(() => {
    vi.mocked(sleep).mockClear();
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async (_url, init) => {
        const jobs = JSON.parse(
            (init as RequestInit).body as string
        ) as unknown[];
        return json(jobs.map(() => ({ data: [{ ticker: 'AAPL' }] })));
    });
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('OPENFIGI_API_KEY', undefined);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('mapCusipsToTickers', () => {
    it('sends ID_CUSIP jobs and maps each CUSIP to its tickers', async () => {
        fetchSpy.mockResolvedValueOnce(
            json([
                { data: [{ ticker: 'AAPL' }, { ticker: 'AAPL' }] },
                { warning: 'No identifier found.' },
            ])
        );
        const result = await mapCusipsToTickers(['037833100', '000000000']);
        expect(bodyOf(0)).toEqual([
            { idType: 'ID_CUSIP', idValue: '037833100' },
            { idType: 'ID_CUSIP', idValue: '000000000' },
        ]);
        expect(result.get('037833100')).toEqual(['AAPL']); // de-duplicated
        expect(result.get('000000000')).toEqual([]); // resolved to nothing
    });

    describe('without an API key (anonymous limits)', () => {
        it('batches 10 jobs per request', async () => {
            await mapCusipsToTickers(cusips(25));
            expect(fetchSpy).toHaveBeenCalledTimes(3);
            expect([0, 1, 2].map(i => bodyOf(i).length)).toEqual([10, 10, 5]);
            expect(headersOf(0)['X-OPENFIGI-APIKEY']).toBeUndefined();
        });

        it('waits ~2.4s between requests (25 requests/minute)', async () => {
            await mapCusipsToTickers(cusips(25));
            expect(vi.mocked(sleep).mock.calls.map(c => c[0])).toEqual([
                2400, 2400,
            ]);
        });
    });

    describe('with an API key', () => {
        it('sends the key and batches 100 jobs per request', async () => {
            vi.stubEnv('OPENFIGI_API_KEY', 'figi-key');
            await mapCusipsToTickers(cusips(150));
            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect([0, 1].map(i => bodyOf(i).length)).toEqual([100, 50]);
            expect(headersOf(0)['X-OPENFIGI-APIKEY']).toBe('figi-key');
        });
    });

    it('stops sending once shouldStop is true and reports only what it resolved', async () => {
        let calls = 0;
        const result = await mapCusipsToTickers(cusips(25), () => calls++ >= 1);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(result.size).toBe(10);
    });

    it('throws OpenFigiRateLimitedError on 429', async () => {
        fetchSpy.mockResolvedValueOnce(json({}, 429));
        await expect(mapCusipsToTickers(['037833100'])).rejects.toBeInstanceOf(
            OpenFigiRateLimitedError
        );
    });

    it('throws on another HTTP error', async () => {
        fetchSpy.mockResolvedValueOnce(json({}, 500));
        await expect(mapCusipsToTickers(['037833100'])).rejects.toThrow(
            'OpenFIGI 500'
        );
    });
});
