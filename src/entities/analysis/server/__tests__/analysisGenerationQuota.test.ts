const { mockCreateCounterStore, mockIsE2E, mockCredentials } = vi.hoisted(
    () => ({
        mockCreateCounterStore: vi.fn(),
        mockIsE2E: vi.fn(() => false),
        mockCredentials: vi.fn(() => ({ url: 'u', token: 't' })),
    })
);

vi.mock('server-only', () => ({}));
vi.mock('@y0ngha/siglens-core', () => ({
    createCounterStore: mockCreateCounterStore,
    // 결정적 해시 — 실제 해시 알고리즘은 core 책임이다.
    hashUsageIp: (ip: string, date: Date) =>
        `h(${ip}@${date.toISOString().slice(0, 10)})`,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockIsE2E }));
vi.mock('@/shared/cache/redisClient', () => ({
    getUpstashWriterCredentials: mockCredentials,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetAnalysisQuotaStoresForTests,
    ANALYSIS_COOKIELESS_IP_GENERATIONS_PER_HOUR,
    ANALYSIS_GUEST_GENERATIONS_PER_DAY,
    ANALYSIS_GUEST_GENERATIONS_PER_HOUR,
    ANALYSIS_GUEST_IP_GENERATIONS_PER_DAY,
    ANALYSIS_MEMBER_GENERATIONS_PER_DAY,
    ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_DAY,
    ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_HOUR,
    nextUtcDayStart,
    nextUtcHourStart,
    QUOTA_RESERVE_TIMEOUT_MS,
    reserveAnalysisGeneration,
} from '@/entities/analysis/server/analysisGenerationQuota';

interface FakeStore {
    consume: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    remaining: ReturnType<typeof vi.fn>;
}

/** prefix → 가짜 저장소. `createCounterStore` 호출 옵션도 함께 기록한다. */
let stores: Map<string, { store: FakeStore; failurePolicy: string }>;

function storeFor(prefix: string): FakeStore {
    const entry = stores.get(prefix);
    if (entry === undefined) throw new Error(`no store ${prefix}`);
    return entry.store;
}

/** 소비 순서를 `prefix subject` 문자열로 기록한다. */
let consumeOrder: string[];

const NOW = new Date('2026-10-06T13:25:00.000Z');
const IP_HASH = 'h(203.0.113.9@2026-10-06)';
const COOKIE_GUEST = {
    kind: 'guest',
    guestId: 'guest-1',
    clientIp: '203.0.113.9',
} as const;
const COOKIELESS_GUEST = { ...COOKIE_GUEST, guestId: null } as const;

/** 저장소를 미리 만들어 둔다(기본: 전부 허락). */
async function primeStores(): Promise<void> {
    await reserveAnalysisGeneration(COOKIE_GUEST, NOW);
    await reserveAnalysisGeneration({ kind: 'member', userId: 'u1' }, NOW);
    vi.clearAllMocks();
    consumeOrder = [];
}

describe('reserveAnalysisGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetAnalysisQuotaStoresForTests();
        mockIsE2E.mockReturnValue(false);
        mockCredentials.mockReturnValue({ url: 'u', token: 't' });
        stores = new Map();
        consumeOrder = [];
        mockCreateCounterStore.mockImplementation(
            (options: { prefix: string; failurePolicy: string }) => {
                const store: FakeStore = {
                    consume: vi.fn(async (subject: string) => {
                        consumeOrder.push(`${options.prefix} ${subject}`);
                        return true;
                    }),
                    refund: vi.fn().mockResolvedValue(undefined),
                    remaining: vi.fn(),
                };
                stores.set(options.prefix, {
                    store,
                    failurePolicy: options.failurePolicy,
                });
                return store;
            }
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it('a guest with a valid cookie consumes the per-IP day window first, then the personal hour/day windows', async () => {
        const result = await reserveAnalysisGeneration(COOKIE_GUEST, NOW);

        expect(result.ok).toBe(true);
        expect(consumeOrder).toEqual([
            `analysis:q:guest-ip ${IP_HASH}`,
            'analysis:q:guest-h g:guest-1:13',
            'analysis:q:guest-d g:guest-1',
        ]);
        expect(storeFor('analysis:q:guest-ip').consume).toHaveBeenCalledWith(
            IP_HASH,
            ANALYSIS_GUEST_IP_GENERATIONS_PER_DAY
        );
        expect(storeFor('analysis:q:guest-h').consume).toHaveBeenCalledWith(
            'g:guest-1:13',
            ANALYSIS_GUEST_GENERATIONS_PER_HOUR
        );
        expect(storeFor('analysis:q:guest-d').consume).toHaveBeenCalledWith(
            'g:guest-1',
            ANALYSIS_GUEST_GENERATIONS_PER_DAY
        );
    });

    it('a guest without a cookie uses only the per-IP axis (hourly + daily), never the strict personal limits', async () => {
        const result = await reserveAnalysisGeneration(COOKIELESS_GUEST, NOW);

        expect(result.ok).toBe(true);
        expect(consumeOrder).toEqual([
            `analysis:q:guest-ip ${IP_HASH}`,
            `analysis:q:guest-ip-h ${IP_HASH}:13`,
        ]);
        expect(storeFor('analysis:q:guest-ip-h').consume).toHaveBeenCalledWith(
            `${IP_HASH}:13`,
            ANALYSIS_COOKIELESS_IP_GENERATIONS_PER_HOUR
        );
    });

    it('pins the approved limit values', () => {
        expect([
            ANALYSIS_GUEST_GENERATIONS_PER_HOUR,
            ANALYSIS_GUEST_GENERATIONS_PER_DAY,
            ANALYSIS_GUEST_IP_GENERATIONS_PER_DAY,
            ANALYSIS_COOKIELESS_IP_GENERATIONS_PER_HOUR,
            ANALYSIS_MEMBER_GENERATIONS_PER_DAY,
        ]).toEqual([20, 60, 200, 60, 300]);
    });

    it('folds IPv6 addresses of one /64 into the same IP bucket', async () => {
        await reserveAnalysisGeneration(
            { ...COOKIELESS_GUEST, clientIp: '2001:db8:1:2::aaaa' },
            NOW
        );
        await reserveAnalysisGeneration(
            { ...COOKIELESS_GUEST, clientIp: '2001:db8:1:2:ffff::1' },
            NOW
        );

        const subjects = storeFor('analysis:q:guest-ip').consume.mock.calls.map(
            c => c[0]
        );
        expect(subjects).toEqual([
            'h(2001:db8:1:2::/64@2026-10-06)',
            'h(2001:db8:1:2::/64@2026-10-06)',
        ]);
    });

    it('treats IPv4-mapped IPv6 as the IPv4 address', async () => {
        await reserveAnalysisGeneration(
            { ...COOKIELESS_GUEST, clientIp: '::ffff:203.0.113.9' },
            NOW
        );
        expect(storeFor('analysis:q:guest-ip').consume).toHaveBeenCalledWith(
            IP_HASH,
            ANALYSIS_GUEST_IP_GENERATIONS_PER_DAY
        );
    });

    it('puts an unknown client IP in one strict shared bucket and logs it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await reserveAnalysisGeneration(
            { ...COOKIELESS_GUEST, clientIp: 'unknown' },
            NOW
        );

        expect(storeFor('analysis:q:guest-ip').consume).toHaveBeenCalledWith(
            'unknown',
            ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_DAY
        );
        expect(storeFor('analysis:q:guest-ip-h').consume).toHaveBeenCalledWith(
            'unknown:13',
            ANALYSIS_UNKNOWN_IP_GENERATIONS_PER_HOUR
        );
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('client ip unknown'),
            undefined
        );
    });

    it('guest stores fail closed and the member store fails open', async () => {
        await primeStores();

        expect(stores.get('analysis:q:guest-h')?.failurePolicy).toBe('closed');
        expect(stores.get('analysis:q:guest-d')?.failurePolicy).toBe('closed');
        expect(stores.get('analysis:q:guest-ip')?.failurePolicy).toBe('closed');
        expect(stores.get('analysis:q:guest-ip-h')?.failurePolicy).toBe(
            'closed'
        );
        expect(stores.get('analysis:q:member')?.failurePolicy).toBe('open');
    });

    it('members consume only the per-user daily window', async () => {
        const result = await reserveAnalysisGeneration(
            { kind: 'member', userId: 'u1' },
            NOW
        );

        expect(result).toMatchObject({ ok: true, audience: 'member' });
        expect(storeFor('analysis:q:member').consume).toHaveBeenCalledWith(
            'u1',
            ANALYSIS_MEMBER_GENERATIONS_PER_DAY
        );
    });

    it('stops at the first full window (IP axis) without further Redis round-trips', async () => {
        await primeStores();
        storeFor('analysis:q:guest-ip').consume.mockResolvedValueOnce(false);

        const result = await reserveAnalysisGeneration(COOKIE_GUEST, NOW);

        expect(result).toEqual({
            ok: false,
            audience: 'guest',
            reason: 'quota',
            retryAt: Date.parse('2026-10-07T00:00:00.000Z'),
        });
        expect(storeFor('analysis:q:guest-h').consume).not.toHaveBeenCalled();
    });

    it('rolls back earlier windows when a later (hourly personal) window is full', async () => {
        await primeStores();
        storeFor('analysis:q:guest-h').consume.mockResolvedValueOnce(false);

        const result = await reserveAnalysisGeneration(COOKIE_GUEST, NOW);

        expect(result).toEqual({
            ok: false,
            audience: 'guest',
            reason: 'quota',
            retryAt: Date.parse('2026-10-06T14:00:00.000Z'),
        });
        expect(storeFor('analysis:q:guest-ip').refund).toHaveBeenCalledWith(
            IP_HASH
        );
        expect(storeFor('analysis:q:guest-d').consume).not.toHaveBeenCalled();
    });

    it('denies guests with reason unavailable when the store throws, and rate-limits the warning', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await primeStores();
        storeFor('analysis:q:guest-h').consume.mockRejectedValue(
            new Error('redis down')
        );

        const first = await reserveAnalysisGeneration(COOKIE_GUEST, NOW);
        await reserveAnalysisGeneration(COOKIE_GUEST, NOW);

        expect(first).toMatchObject({
            ok: false,
            audience: 'guest',
            reason: 'unavailable',
        });
        expect(storeFor('analysis:q:guest-ip').refund).toHaveBeenCalledTimes(2);
        const storeWarnings = warn.mock.calls.filter(c =>
            String(c[0]).includes('store unavailable')
        );
        expect(storeWarnings).toHaveLength(1);
    });

    it('treats a reservation slower than the timeout as an outage and refunds it when it completes late', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await primeStores();
        vi.useFakeTimers();
        let release!: () => void;
        storeFor('analysis:q:guest-ip').consume.mockImplementationOnce(
            () =>
                new Promise<boolean>(resolve => {
                    release = () => resolve(true);
                })
        );

        const pending = reserveAnalysisGeneration(COOKIELESS_GUEST, NOW);
        await vi.advanceTimersByTimeAsync(QUOTA_RESERVE_TIMEOUT_MS);
        const result = await pending;

        expect(result).toMatchObject({ ok: false, reason: 'unavailable' });

        release();
        await vi.runAllTimersAsync();
        expect(storeFor('analysis:q:guest-ip').refund).toHaveBeenCalledWith(
            IP_HASH
        );
    });

    it('lets members through when the reservation times out (fail-open)', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await primeStores();
        vi.useFakeTimers();
        storeFor('analysis:q:member').consume.mockImplementationOnce(
            () => new Promise<boolean>(() => {})
        );

        const pending = reserveAnalysisGeneration(
            { kind: 'member', userId: 'u1' },
            NOW
        );
        await vi.advanceTimersByTimeAsync(QUOTA_RESERVE_TIMEOUT_MS);

        expect(await pending).toMatchObject({ ok: true, audience: 'member' });
    });

    it('refund returns every consumed window exactly once even if called twice', async () => {
        const result = await reserveAnalysisGeneration(COOKIE_GUEST, NOW);
        if (!result.ok) throw new Error('expected ok');

        await result.refund();
        await result.refund();

        expect(storeFor('analysis:q:guest-ip').refund).toHaveBeenCalledTimes(1);
        expect(storeFor('analysis:q:guest-h').refund).toHaveBeenCalledWith(
            'g:guest-1:13'
        );
        expect(storeFor('analysis:q:guest-d').refund).toHaveBeenCalledWith(
            'g:guest-1'
        );
    });

    it('is bypassed under E2E', async () => {
        mockIsE2E.mockReturnValue(true);
        const result = await reserveAnalysisGeneration(COOKIE_GUEST, NOW);
        expect(result.ok).toBe(true);
        expect(mockCreateCounterStore).not.toHaveBeenCalled();
    });

    it('is bypassed without Redis outside production, but enforced (fail-closed) in production', async () => {
        mockCredentials.mockReturnValue(null as never);
        vi.stubEnv('NODE_ENV', 'development');
        expect((await reserveAnalysisGeneration(COOKIE_GUEST, NOW)).ok).toBe(
            true
        );
        expect(mockCreateCounterStore).not.toHaveBeenCalled();

        vi.stubEnv('NODE_ENV', 'production');
        await reserveAnalysisGeneration(COOKIE_GUEST, NOW);
        expect(mockCreateCounterStore).toHaveBeenCalled();
    });
});

describe('window boundaries', () => {
    it('next UTC hour and day', () => {
        expect(nextUtcHourStart(NOW)).toBe(
            Date.parse('2026-10-06T14:00:00.000Z')
        );
        expect(nextUtcDayStart(NOW)).toBe(
            Date.parse('2026-10-07T00:00:00.000Z')
        );
    });
});
