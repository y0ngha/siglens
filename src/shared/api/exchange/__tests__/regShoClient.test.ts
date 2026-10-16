import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ExchangeHttpError,
    fetchRegShoThresholdText,
    REG_SHO_MAX_BODY_BYTES,
    regShoThresholdUrl,
} from '../regShoClient';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/sleep', () => ({ sleep: async () => undefined }));

/** Deny-by-default fetch: any request not stubbed by the test fails it. */
const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

describe('regShoClient', () => {
    beforeEach(() => {
        fetchSpy.mockClear();
        vi.stubGlobal('fetch', fetchSpy);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('regShoThresholdUrl', () => {
        it('builds the Nasdaq Trader daily file URL', () => {
            expect(regShoThresholdUrl('nasdaq', '2026-10-15')).toBe(
                'https://www.nasdaqtrader.com/dynamic/symdir/regsho/nasdaqth20261015.txt'
            );
        });

        it('builds the Cboe BZX daily file URL', () => {
            expect(regShoThresholdUrl('cboe_bzx', '2026-10-15')).toBe(
                'https://cdn.cboe.com/resources/us/equities/market-statistics/reg-sho-threshold/bzx_equities_reg_sho_threshold_20261015.txt'
            );
        });

        it.each([
            ['nyse', 'NYSE'],
            ['nyse_american', 'NYSE%20American'],
            ['nyse_arca', 'NYSE%20Arca'],
        ] as const)('builds the NYSE API URL for %s', (market, param) => {
            expect(regShoThresholdUrl(market, '2026-10-15')).toBe(
                `https://www.nyse.com/api/regulatory/threshold-securities/download?selectedDate=2026-10-15&market=${param}`
            );
        });
    });

    describe('fetchRegShoThresholdText', () => {
        it('returns the list text and does not follow redirects', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response('Symbol|Security Name\n', { status: 200 })
            );
            expect(await fetchRegShoThresholdText('nasdaq', '2026-10-15')).toBe(
                'Symbol|Security Name\n'
            );
            expect(fetchSpy).toHaveBeenCalledWith(
                regShoThresholdUrl('nasdaq', '2026-10-15'),
                expect.objectContaining({ redirect: 'manual' })
            );
        });

        it('treats a 302 (Nasdaq: not published yet) as no file', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response(null, {
                    status: 302,
                    headers: { location: '/Trader.aspx?id=http404' },
                })
            );
            expect(
                await fetchRegShoThresholdText('nasdaq', '2026-10-16')
            ).toBeNull();
        });

        it('treats a 404 as no file', async () => {
            fetchSpy.mockResolvedValueOnce(new Response('', { status: 404 }));
            expect(
                await fetchRegShoThresholdText('cboe_bzx', '2026-10-16')
            ).toBeNull();
        });

        const ACCESS_DENIED =
            '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>';

        it('treats a Cboe S3 AccessDenied 403 (no file that day) as no file', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response(ACCESS_DENIED, { status: 403 })
            );
            expect(
                await fetchRegShoThresholdText('cboe_bzx', '2025-11-27')
            ).toBeNull();
        });

        it('throws on a 403 from another market even with the AccessDenied body', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response(ACCESS_DENIED, { status: 403 })
            );
            await expect(
                fetchRegShoThresholdText('nyse', '2026-10-15')
            ).rejects.toBeInstanceOf(ExchangeHttpError);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('throws on a Cboe 403 without the AccessDenied marker (a block, not a missing day)', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response('<html>Forbidden</html>', { status: 403 })
            );
            await expect(
                fetchRegShoThresholdText('cboe_bzx', '2026-10-15')
            ).rejects.toBeInstanceOf(ExchangeHttpError);
        });

        it('refuses a body whose Content-Length exceeds the cap without reading it', async () => {
            let pulled = false;
            // highWaterMark 0: the stream pulls only when someone reads
            const body = new ReadableStream<Uint8Array>(
                {
                    pull() {
                        pulled = true;
                    },
                },
                { highWaterMark: 0 }
            );
            fetchSpy.mockResolvedValueOnce(
                new Response(body, {
                    status: 200,
                    headers: {
                        'content-length': String(REG_SHO_MAX_BODY_BYTES + 1),
                    },
                })
            );
            await expect(
                fetchRegShoThresholdText('nasdaq', '2026-10-15')
            ).rejects.toThrow('exchange body too large');
            expect(pulled).toBe(false);
        });

        it('stops reading an undeclared body once it passes the cap', async () => {
            let pulls = 0;
            const chunk = new Uint8Array(256 * 1024);
            const body = new ReadableStream<Uint8Array>({
                pull(controller) {
                    pulls += 1;
                    controller.enqueue(chunk);
                },
            });
            fetchSpy.mockResolvedValueOnce(new Response(body, { status: 200 }));
            await expect(
                fetchRegShoThresholdText('nasdaq', '2026-10-15')
            ).rejects.toThrow('exchange body too large');
            // a never-ending body: reading stopped just past the cap (plus read-ahead)
            expect(pulls).toBeLessThan(
                REG_SHO_MAX_BODY_BYTES / chunk.length + 4
            );
        });

        it('reads a body exactly at the cap', async () => {
            fetchSpy.mockResolvedValueOnce(
                new Response('a'.repeat(REG_SHO_MAX_BODY_BYTES), {
                    status: 200,
                })
            );
            expect(
                (await fetchRegShoThresholdText('nasdaq', '2026-10-15'))?.length
            ).toBe(REG_SHO_MAX_BODY_BYTES);
        });

        it('retries a 5xx once', async () => {
            fetchSpy
                .mockResolvedValueOnce(new Response('', { status: 503 }))
                .mockResolvedValueOnce(new Response('Symbol|CompanyName\n'));
            expect(
                await fetchRegShoThresholdText('cboe_bzx', '2026-10-15')
            ).toBe('Symbol|CompanyName\n');
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });
});
