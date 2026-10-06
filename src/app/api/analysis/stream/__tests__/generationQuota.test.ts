const { mockCookieStore, mockReserve, mockGetClientIp } = vi.hoisted(() => {
    const jar = new Map<string, string>();
    return {
        mockCookieStore: {
            jar,
            get: vi.fn((name: string) =>
                jar.has(name) ? { name, value: jar.get(name) } : undefined
            ),
            set: vi.fn(),
        },
        mockReserve: vi.fn(),
        mockGetClientIp: vi.fn(),
    };
});

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
    cookies: async () => mockCookieStore,
}));
vi.mock('@/shared/api/getClientIp', () => ({ getClientIp: mockGetClientIp }));
vi.mock('@/entities/analysis/server/analysisGenerationQuota', () => ({
    reserveAnalysisGeneration: mockReserve,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DONE_STATUS_PROBE,
    reserveGenerationGate,
    settleGenerationGate,
} from '@/app/api/analysis/stream/generationQuota';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';
import { LocalizedStreamError } from '@/shared/lib/sse/LocalizedStreamError';
import { RateLimitedStreamError } from '@/shared/lib/sse/analysisRateLimit';

describe('reserveGenerationGate — guest identity on siglens.io', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCookieStore.jar.clear();
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', 'test-secret');
        mockGetClientIp.mockResolvedValue('203.0.113.9');
        mockReserve.mockResolvedValue({
            ok: true,
            audience: 'guest',
            refund: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('mints a signed host-only guest cookie on the response and counts the first request on the IP axis only', async () => {
        await reserveGenerationGate(null, false);

        expect(mockCookieStore.set).toHaveBeenCalledOnce();
        const [name, value, options] = mockCookieStore.set.mock.calls[0];
        expect(name).toBe(GUEST_ID_COOKIE_NAME);
        expect(value).toMatch(/^[0-9a-f-]{36}\..+/);
        expect(options).not.toHaveProperty('domain');
        expect(options).toMatchObject({ httpOnly: true, path: '/' });

        expect(mockReserve).toHaveBeenCalledWith({
            kind: 'guest',
            guestId: null,
            clientIp: '203.0.113.9',
        });
    });

    it('uses the personal axis once the request carries the minted cookie, without minting again', async () => {
        await reserveGenerationGate(null, false);
        const minted = mockCookieStore.set.mock.calls[0][1] as string;
        mockCookieStore.jar.set(GUEST_ID_COOKIE_NAME, minted);
        mockCookieStore.set.mockClear();

        await reserveGenerationGate(null, false);

        expect(mockCookieStore.set).not.toHaveBeenCalled();
        expect(mockReserve).toHaveBeenLastCalledWith({
            kind: 'guest',
            guestId: minted.split('.')[0],
            clientIp: '203.0.113.9',
        });
    });

    it('ignores a forged cookie (falls back to IP axis and re-mints)', async () => {
        mockCookieStore.jar.set(
            GUEST_ID_COOKIE_NAME,
            '00000000-0000-4000-8000-000000000000.forged'
        );

        await reserveGenerationGate(null, false);

        expect(mockReserve).toHaveBeenCalledWith(
            expect.objectContaining({ guestId: null })
        );
        expect(mockCookieStore.set).toHaveBeenCalledOnce();
    });

    it('members are keyed by userId and never get a guest cookie', async () => {
        await reserveGenerationGate('user-1', false);

        expect(mockReserve).toHaveBeenCalledWith({
            kind: 'member',
            userId: 'user-1',
        });
        expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it('never throws: an identity failure is fail-closed for guests', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGetClientIp.mockRejectedValue(new Error('headers() outside scope'));

        const gate = await reserveGenerationGate(null, false);

        expect(gate).toMatchObject({
            kind: 'rate_limited',
            audience: 'guest',
            reason: 'unavailable',
        });
        expect(mockReserve).not.toHaveBeenCalled();
    });

    it('skips the reservation (and the cookie) when the client asked for cache-only', async () => {
        expect(await reserveGenerationGate(null, true)).toEqual({
            kind: 'exempt',
        });
        expect(mockReserve).not.toHaveBeenCalled();
        expect(mockCookieStore.set).not.toHaveBeenCalled();
    });
});

describe('settleGenerationGate', () => {
    it('carries the denial reason into the rate_limited error', async () => {
        const settled = settleGenerationGate(
            Promise.resolve({ status: 'miss_no_trigger' }),
            {
                kind: 'rate_limited',
                audience: 'guest',
                reason: 'unavailable',
                retryAt: 1,
            },
            DONE_STATUS_PROBE
        );

        await expect(settled).rejects.toBeInstanceOf(RateLimitedStreamError);
        await expect(settled).rejects.toMatchObject({
            payload: { audience: 'guest', reason: 'unavailable', retryAt: 1 },
        });
    });

    it.each([
        ['a pre-provider failure (refund)', new Error('fmp down'), 1],
        ['a deadline timeout (keep)', new LocalizedStreamError('timeout'), 0],
    ])('rejection with %s', async (_label, error, refunds) => {
        const refund = vi.fn().mockResolvedValue(undefined);
        await settleGenerationGate(
            Promise.reject(error),
            { kind: 'allowed', refund },
            DONE_STATUS_PROBE
        ).catch(() => {});

        expect(refund).toHaveBeenCalledTimes(refunds);
    });
});
