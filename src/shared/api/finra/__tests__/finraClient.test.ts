import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    cnmsShortVolumeUrl,
    fetchCnmsShortVolumeText,
    fetchShortInterestText,
    shortInterestUrl,
} from '../finraClient';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/sleep', () => ({ sleep: async () => undefined }));

const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);
const ACCESS_DENIED =
    '<?xml version="1.0"?><Error><Code>AccessDenied</Code></Error>';

beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('FINRA URLs', () => {
    it('builds the CNMS daily file URL', () => {
        expect(cnmsShortVolumeUrl('2026-10-14')).toBe(
            'https://cdn.finra.org/equity/regsho/daily/CNMSshvol20261014.txt'
        );
    });

    it('builds the biweekly short interest file URL', () => {
        expect(shortInterestUrl('2026-09-30')).toBe(
            'https://cdn.finra.org/equity/otcmarket/biweekly/shrt20260930.csv'
        );
    });
});

describe('fetching', () => {
    it('returns the file text', async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response('Date|Symbol\n', { status: 200 })
        );
        expect(await fetchCnmsShortVolumeText('2026-10-14')).toBe(
            'Date|Symbol\n'
        );
        expect(fetchSpy.mock.calls[0]?.[0]).toBe(
            cnmsShortVolumeUrl('2026-10-14')
        );
    });

    it('returns null for the S3 AccessDenied 403 (holiday / not yet published) and for 404', async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response(ACCESS_DENIED, { status: 403 })
        );
        expect(await fetchShortInterestText('2026-10-15')).toBeNull();
        fetchSpy.mockResolvedValueOnce(new Response('', { status: 404 }));
        expect(await fetchShortInterestText('2026-10-15')).toBeNull();
    });

    it('throws on another 403 instead of treating it as missing', async () => {
        fetchSpy.mockResolvedValueOnce(
            new Response('<html>blocked</html>', { status: 403 })
        );
        await expect(
            fetchCnmsShortVolumeText('2026-10-14')
        ).rejects.toMatchObject({ name: 'FinraHttpError', status: 403 });
        // a blocked 403 is not transient: exactly one request, no retry
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('retries a 503 and then succeeds', async () => {
        fetchSpy
            .mockResolvedValueOnce(new Response('', { status: 503 }))
            .mockResolvedValueOnce(new Response('ok', { status: 200 }));
        expect(await fetchCnmsShortVolumeText('2026-10-14')).toBe('ok');
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});
