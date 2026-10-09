const { mockCookieStore, mockReserve, mockGetClientIp, mockIsVerifiedCrawler } =
    vi.hoisted(() => {
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
            mockIsVerifiedCrawler: vi.fn(),
        };
    });

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
    cookies: async () => mockCookieStore,
}));
vi.mock('@/shared/api/getClientIp', () => ({ getClientIp: mockGetClientIp }));
vi.mock('@/shared/api/verifiedCrawler', () => ({
    isVerifiedCrawler: mockIsVerifiedCrawler,
}));
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
    createGuestResolver,
    createPromptAssemblyTracker,
    DONE_STATUS_PROBE,
    reserveGenerationGate,
    settleGenerationGate,
    shouldAttemptReanalyze,
} from '@/app/api/analysis/stream/generationQuota';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';
import { LocalizedStreamError } from '@/shared/lib/sse/LocalizedStreamError';
import { RateLimitedStreamError } from '@/shared/lib/sse/analysisRateLimit';

const BROWSER_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const GOOGLEBOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BROWSER_HEADERS = new Headers({
    'user-agent': BROWSER_UA,
    'cf-connecting-ip': '203.0.113.9',
});
/** Cloudflare를 거친 진짜 Googlebot 요청의 헤더 모양. */
const CRAWLER_HEADERS = new Headers({
    'user-agent': GOOGLEBOT_UA,
    'cf-connecting-ip': '66.249.66.1',
});

describe('reserveGenerationGate — guest identity on siglens.io', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCookieStore.jar.clear();
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', 'test-secret');
        mockGetClientIp.mockResolvedValue('203.0.113.9');
        mockIsVerifiedCrawler.mockResolvedValue(false);
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
        await reserveGenerationGate(null, false, BROWSER_HEADERS);

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
        await reserveGenerationGate(null, false, BROWSER_HEADERS);
        const minted = mockCookieStore.set.mock.calls[0][1] as string;
        mockCookieStore.jar.set(GUEST_ID_COOKIE_NAME, minted);
        mockCookieStore.set.mockClear();

        await reserveGenerationGate(null, false, BROWSER_HEADERS);

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

        await reserveGenerationGate(null, false, BROWSER_HEADERS);

        expect(mockReserve).toHaveBeenCalledWith(
            expect.objectContaining({ guestId: null })
        );
        expect(mockCookieStore.set).toHaveBeenCalledOnce();
    });

    it('members are keyed by userId and never get a guest cookie', async () => {
        await reserveGenerationGate('user-1', false, BROWSER_HEADERS);

        expect(mockReserve).toHaveBeenCalledWith({
            kind: 'member',
            userId: 'user-1',
        });
        expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it('never throws: an identity failure is fail-closed for guests', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGetClientIp.mockRejectedValue(new Error('headers() outside scope'));

        const gate = await reserveGenerationGate(null, false, BROWSER_HEADERS);

        expect(gate).toMatchObject({
            kind: 'rate_limited',
            audience: 'guest',
            reason: 'unavailable',
        });
        expect(mockReserve).not.toHaveBeenCalled();
    });

    it('skips the reservation (and the cookie) when the client asked for cache-only', async () => {
        expect(
            await reserveGenerationGate(null, true, BROWSER_HEADERS)
        ).toEqual({
            kind: 'exempt',
        });
        expect(mockReserve).not.toHaveBeenCalled();
        expect(mockCookieStore.set).not.toHaveBeenCalled();
    });
});

describe('createGuestResolver — 요청당 한 번만 해석한다', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCookieStore.jar.clear();
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', 'test-secret');
        mockGetClientIp.mockResolvedValue('203.0.113.9');
        mockIsVerifiedCrawler.mockResolvedValue(false);
        mockReserve.mockResolvedValue({
            ok: true,
            audience: 'guest',
            refund: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('쿠키가 없으면 발급한 id를 meterGuestId로 주되 생성 한도용 id는 null로 둔다', async () => {
        const context = await createGuestResolver(BROWSER_HEADERS).context();

        const minted = mockCookieStore.set.mock.calls[0][1] as string;
        expect(context).toEqual({
            quotaGuestId: null,
            meterGuestId: minted.split('.')[0],
            clientIp: '203.0.113.9',
        });
    });

    it('쿠키가 있으면 같은 id를 양쪽에 쓰고 새로 발급하지 않는다', async () => {
        const resolver = createGuestResolver(BROWSER_HEADERS);
        await resolver.context();
        const minted = mockCookieStore.set.mock.calls[0][1] as string;
        mockCookieStore.jar.set(GUEST_ID_COOKIE_NAME, minted);
        mockCookieStore.set.mockClear();

        const context = await createGuestResolver(BROWSER_HEADERS).context();

        expect(mockCookieStore.set).not.toHaveBeenCalled();
        expect(context.quotaGuestId).toBe(minted.split('.')[0]);
        expect(context.meterGuestId).toBe(minted.split('.')[0]);
    });

    it('같은 해석기를 한도 예약과 미터가 함께 써도 쿠키는 한 번만 발급된다', async () => {
        const resolver = createGuestResolver(BROWSER_HEADERS);

        await reserveGenerationGate(null, false, BROWSER_HEADERS, resolver);
        await resolver.context();

        expect(mockCookieStore.set).toHaveBeenCalledOnce();
    });

    it('cacheOnly 요청도 해석기로 신원을 얻을 수 있다(한도 예약은 건너뛴다)', async () => {
        const resolver = createGuestResolver(BROWSER_HEADERS);

        await reserveGenerationGate(null, true, BROWSER_HEADERS, resolver);
        const context = await resolver.context();

        expect(mockReserve).not.toHaveBeenCalled();
        expect(context.meterGuestId).not.toBeNull();
    });

    it('크롤러 판정은 한 번만 DNS를 조회한다', async () => {
        mockIsVerifiedCrawler.mockResolvedValue(true);
        const resolver = createGuestResolver(CRAWLER_HEADERS);

        expect(await resolver.isCrawler()).toBe(true);
        expect(await resolver.isCrawler()).toBe(true);

        expect(mockIsVerifiedCrawler).toHaveBeenCalledOnce();
    });
});

describe('reserveGenerationGate — verified search crawlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCookieStore.jar.clear();
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', 'test-secret');
        mockGetClientIp.mockResolvedValue('66.249.66.1');
        mockReserve.mockResolvedValue({
            ok: true,
            audience: 'guest',
            refund: vi.fn(),
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('a DNS-verified crawler skips the quota entirely (no reserve, nothing to refund)', async () => {
        mockIsVerifiedCrawler.mockResolvedValue(true);

        const gate = await reserveGenerationGate(null, false, CRAWLER_HEADERS);

        expect(gate).toEqual({ kind: 'exempt' });
        expect(mockIsVerifiedCrawler).toHaveBeenCalledWith(
            '66.249.66.1',
            GOOGLEBOT_UA
        );
        expect(mockReserve).not.toHaveBeenCalled();
    });

    it('a spoofed crawler UA that fails DNS verification is still limited', async () => {
        mockIsVerifiedCrawler.mockResolvedValue(false);
        mockReserve.mockResolvedValue({
            ok: false,
            audience: 'guest',
            reason: 'quota',
            retryAt: 1,
        });

        const gate = await reserveGenerationGate(null, false, CRAWLER_HEADERS);

        expect(gate).toMatchObject({ kind: 'rate_limited', reason: 'quota' });
        expect(mockReserve).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'guest', clientIp: '66.249.66.1' })
        );
    });

    it('an X-Forwarded-For-only request (no cf-connecting-ip) never reaches DNS verification and stays limited', async () => {
        // getClientIp는 XFF 첫 값으로 물러난다 — 호출자가 심은 Googlebot IP다.
        mockGetClientIp.mockResolvedValue('66.249.66.1');
        mockIsVerifiedCrawler.mockResolvedValue(true);
        mockReserve.mockResolvedValue({
            ok: false,
            audience: 'guest',
            reason: 'quota',
            retryAt: 1,
        });

        const gate = await reserveGenerationGate(
            null,
            false,
            new Headers({
                'user-agent': GOOGLEBOT_UA,
                'x-forwarded-for': '66.249.66.1',
            })
        );

        expect(mockIsVerifiedCrawler).not.toHaveBeenCalled();
        expect(gate).toMatchObject({ kind: 'rate_limited', reason: 'quota' });
        expect(mockReserve).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'guest', clientIp: '66.249.66.1' })
        );
    });

    it('a blank cf-connecting-ip is treated as absent', async () => {
        await reserveGenerationGate(
            null,
            false,
            new Headers({ 'user-agent': GOOGLEBOT_UA, 'cf-connecting-ip': ' ' })
        );

        expect(mockIsVerifiedCrawler).not.toHaveBeenCalled();
        expect(mockReserve).toHaveBeenCalledOnce();
    });

    it('members are never routed through crawler verification', async () => {
        mockIsVerifiedCrawler.mockResolvedValue(true);

        const gate = await reserveGenerationGate(
            'user-1',
            false,
            CRAWLER_HEADERS
        );

        expect(gate.kind).toBe('allowed');
        expect(mockIsVerifiedCrawler).not.toHaveBeenCalled();
        expect(mockReserve).toHaveBeenCalledWith({
            kind: 'member',
            userId: 'user-1',
        });
    });

    it('a verified-crawler exemption from the slot is never refunded', async () => {
        mockIsVerifiedCrawler.mockResolvedValue(true);
        const slot = createGenerationGateSlot();

        expect(await slot.reserve(null, false, CRAWLER_HEADERS)).toEqual({
            kind: 'exempt',
        });
        await expect(slot.release()).resolves.toBeUndefined();
        expect(mockReserve).not.toHaveBeenCalled();
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
        mockIsVerifiedCrawler.mockResolvedValue(false);
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

        const gate = await slot.reserve('user-1', false, BROWSER_HEADERS);
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
        await denied.reserve(null, false, BROWSER_HEADERS);
        await expect(denied.release()).resolves.toBeUndefined();

        const exempt = createGenerationGateSlot();
        expect(await exempt.reserve(null, true, BROWSER_HEADERS)).toEqual({
            kind: 'exempt',
        });
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
