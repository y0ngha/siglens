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
vi.mock(
    '@/entities/analysis/server/analysisGenerationQuota',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/analysis/server/analysisGenerationQuota')
        >()),
        reserveAnalysisGeneration: mockReserve,
    })
);

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createGenerationGateSlot,
    createPromptAssemblyTracker,
    DONE_STATUS_PROBE,
    reserveGenerationGate,
    settleGenerationGate,
    shouldAttemptReanalyze,
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

describe('createGenerationGateSlot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetClientIp.mockResolvedValue('203.0.113.9');
    });

    it('release before reserve is a safe no-op', async () => {
        const slot = createGenerationGateSlot();
        await expect(slot.release()).resolves.toBeUndefined();
        expect(mockReserve).not.toHaveBeenCalled();
    });

    it('release refunds the reservation once even if called repeatedly', async () => {
        const refund = vi.fn().mockResolvedValue(undefined);
        mockReserve.mockResolvedValue({ ok: true, audience: 'member', refund });
        const slot = createGenerationGateSlot();

        const gate = await slot.reserve('user-1', false);
        await slot.release();
        await slot.release();

        expect(gate.kind).toBe('allowed');
        expect(refund).toHaveBeenCalledOnce();
    });

    it('release after a denial or exempt reservation never refunds', async () => {
        mockReserve.mockResolvedValue({
            ok: false,
            audience: 'guest',
            reason: 'quota',
            retryAt: 1,
        });
        const denied = createGenerationGateSlot();
        await denied.reserve(null, false);
        await expect(denied.release()).resolves.toBeUndefined();

        const exempt = createGenerationGateSlot();
        expect(await exempt.reserve(null, true)).toEqual({ kind: 'exempt' });
        await expect(exempt.release()).resolves.toBeUndefined();
    });
});

describe('createPromptAssemblyTracker', () => {
    it('reports no generation until core assembles a prompt', () => {
        const tracker = createPromptAssemblyTracker();
        expect(tracker.probe.onResolved({ status: 'cached' })).toBe(false);
        expect(tracker.probe.onRejected(new Error('x'))).toBe(false);
    });

    it('reports a generation after the callback fires, idempotently', () => {
        const tracker = createPromptAssemblyTracker();
        tracker.onPromptAssembled();
        tracker.onPromptAssembled();
        expect(tracker.probe.onResolved({ status: 'done' })).toBe(true);
        expect(tracker.probe.onRejected(new Error('x'))).toBe(true);
    });

    it('keeps separate state per request', () => {
        const first = createPromptAssemblyTracker();
        const second = createPromptAssemblyTracker();
        first.onPromptAssembled();
        expect(second.probe.onResolved({})).toBe(false);
    });
});

describe('shouldAttemptReanalyze', () => {
    it.each([
        [true, false, true],
        [true, true, false],
        [false, false, false],
        ['true', false, false],
        [undefined, false, false],
    ])('requested=%j rateLimited=%j → %j', (requested, limited, expected) => {
        expect(shouldAttemptReanalyze(requested, limited)).toBe(expected);
    });
});
