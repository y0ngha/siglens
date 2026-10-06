vi.mock('server-only', () => ({}));

const { mockReverse, mockResolve4, mockResolve6, resolverOptions, store } =
    vi.hoisted(() => ({
        mockReverse: vi.fn(),
        mockResolve4: vi.fn(),
        mockResolve6: vi.fn(),
        resolverOptions: [] as unknown[],
        store: new Map<string, { value: unknown; ex: number | undefined }>(),
    }));

vi.mock('node:dns/promises', () => ({
    Resolver: class {
        constructor(options: unknown) {
            resolverOptions.push(options);
        }
        reverse = mockReverse;
        resolve4 = mockResolve4;
        resolve6 = mockResolve6;
    },
}));

const { mockGet, mockSet, mockRedis } = vi.hoisted(() => {
    const mockGet = vi.fn(async (key: string) => store.get(key)?.value ?? null);
    const mockSet = vi.fn(
        async (key: string, value: unknown, opts?: { ex?: number }) => {
            store.set(key, { value, ex: opts?.ex });
            return 'OK';
        }
    );
    return { mockGet, mockSet, mockRedis: { get: mockGet, set: mockSet } };
});

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => mockRedis),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    __resetVerifiedCrawlerForTests,
    canonicalIp,
    claimedCrawler,
    isVerifiedCrawler,
    MAX_IN_FLIGHT_VERIFICATIONS,
    MAX_PTR_HOSTS,
    REJECTED_MEMORY_TTL_MS,
    VERIFIED_TTL_SECONDS,
    VERIFY_TIMEOUT_MS,
} from '@/shared/api/verifiedCrawler';

const GOOGLEBOT_UA =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/130.0.0.0 Safari/537.36';
const BINGBOT_UA =
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
const YETI_UA = 'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)';
const DAUMOA_UA =
    'Mozilla/5.0 (compatible; Daumoa/2.0; +https://searchadvisor.daum.net/robots)';
const CHROME_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const GOOGLE_IP = '66.249.66.1';
const GOOGLE_HOST = 'crawl-66-249-66-1.googlebot.com';

function dnsError(code: string): Error & { code: string } {
    return Object.assign(new Error(`query failed: ${code}`), { code });
}

function genuineGooglebotDns(): void {
    mockReverse.mockResolvedValue([GOOGLE_HOST]);
    mockResolve4.mockResolvedValue([GOOGLE_IP]);
}

function storedEntries(): { value: unknown; ex: number | undefined }[] {
    return [...store.values()];
}

describe('isVerifiedCrawler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store.clear();
        resolverOptions.length = 0;
        __resetVerifiedCrawlerForTests();
        vi.mocked(getRedisClient).mockReturnValue(mockRedis as never);
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('no verification attempted', () => {
        it('a normal browser UA does no DNS and no cache I/O', async () => {
            expect(await isVerifiedCrawler(GOOGLE_IP, CHROME_UA)).toBe(false);

            expect(mockReverse).not.toHaveBeenCalled();
            expect(mockGet).not.toHaveBeenCalled();
            expect(resolverOptions).toHaveLength(0);
        });

        it('a missing or empty UA does no DNS', async () => {
            expect(await isVerifiedCrawler(GOOGLE_IP, null)).toBe(false);
            expect(await isVerifiedCrawler(GOOGLE_IP, '')).toBe(false);

            expect(mockReverse).not.toHaveBeenCalled();
        });

        it('a zone-id IPv6 address resolves false without throwing or DNS', async () => {
            await expect(
                isVerifiedCrawler('fe80::1%eth0', GOOGLEBOT_UA)
            ).resolves.toBe(false);
            expect(mockReverse).not.toHaveBeenCalled();
        });

        it('the unknown client IP is never verified, even with a crawler UA', async () => {
            genuineGooglebotDns();

            expect(await isVerifiedCrawler('unknown', GOOGLEBOT_UA)).toBe(
                false
            );
            expect(await isVerifiedCrawler('not-an-ip', GOOGLEBOT_UA)).toBe(
                false
            );

            expect(mockReverse).not.toHaveBeenCalled();
            expect(mockGet).not.toHaveBeenCalled();
        });
    });

    describe('DNS verification', () => {
        it('verifies a genuine Googlebot (PTR suffix + forward match) and caches it for 24h', async () => {
            genuineGooglebotDns();

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(true);

            expect(mockReverse).toHaveBeenCalledWith(GOOGLE_IP);
            expect(mockResolve4).toHaveBeenCalledWith(GOOGLE_HOST);
            expect(storedEntries()).toEqual([
                { value: '1', ex: VERIFIED_TTL_SECONDS },
            ]);
            // 원시 IP는 Redis 키에 남지 않는다.
            expect([...store.keys()][0]).not.toContain(GOOGLE_IP);
        });

        it('bounds each DNS query with the verification timeout', async () => {
            genuineGooglebotDns();

            await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA);

            expect(resolverOptions).toEqual([
                { timeout: VERIFY_TIMEOUT_MS, tries: 1 },
            ]);
        });

        it('rejects a spoofed UA whose PTR is not a Google domain, without a forward lookup, and never writes the rejection to Redis', async () => {
            mockReverse.mockResolvedValue([
                'ec2-198-51-100-7.compute-1.amazonaws.com',
            ]);

            expect(await isVerifiedCrawler('198.51.100.7', GOOGLEBOT_UA)).toBe(
                false
            );

            expect(mockResolve4).not.toHaveBeenCalled();
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('rejects googleusercontent.com PTRs (Google Cloud customer VMs)', async () => {
            mockReverse.mockResolvedValue([
                '7.100.51.198.bc.googleusercontent.com',
            ]);
            mockResolve4.mockResolvedValue(['198.51.100.7']);

            expect(await isVerifiedCrawler('198.51.100.7', GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockResolve4).not.toHaveBeenCalled();
        });

        it('rejects a PTR that only contains the crawler domain as a label', async () => {
            mockReverse.mockResolvedValue([
                'crawl.googlebot.com.attacker.example',
            ]);

            expect(await isVerifiedCrawler('198.51.100.7', GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockResolve4).not.toHaveBeenCalled();
        });

        it('rejects a PTR match whose forward lookup does not include the IP', async () => {
            mockReverse.mockResolvedValue([GOOGLE_HOST]);
            mockResolve4.mockResolvedValue(['66.249.66.2']);

            expect(await isVerifiedCrawler('198.51.100.7', GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('treats a missing PTR record (ENOTFOUND) as a definitive rejection', async () => {
            mockReverse.mockRejectedValue(dnsError('ENOTFOUND'));

            expect(await isVerifiedCrawler('198.51.100.7', GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockSet).not.toHaveBeenCalled();
        });

        it('treats ENODATA on the forward lookup as "no match", a definitive rejection', async () => {
            vi.useFakeTimers();
            mockReverse.mockResolvedValue([GOOGLE_HOST]);
            mockResolve4.mockRejectedValue(dnsError('ENODATA'));

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockSet).not.toHaveBeenCalled();

            // 장애(1분)가 아니라 확정 실패(1h)로 기억된다.
            vi.advanceTimersByTime(2 * 60_000);
            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockReverse).toHaveBeenCalledOnce();
        });

        it(`forward-checks only the first ${MAX_PTR_HOSTS} matching PTR hosts`, async () => {
            const hosts = Array.from(
                { length: MAX_PTR_HOSTS + 2 },
                (_, i) => `crawl-${i}.googlebot.com`
            );
            mockReverse.mockResolvedValue(hosts);
            mockResolve4.mockImplementation(async (host: string) =>
                // 맨 끝 호스트만 원래 IP로 풀린다 — 상한 밖이라 보지 않아야 한다.
                host === hosts.at(-1) ? [GOOGLE_IP] : ['66.249.66.250']
            );

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockResolve4).toHaveBeenCalledTimes(MAX_PTR_HOSTS);
            expect(mockResolve4.mock.calls.map(([host]) => host)).toEqual(
                hosts.slice(0, MAX_PTR_HOSTS)
            );
        });

        it('verifies an IPv4-mapped IPv6 client against its IPv4 PTR and A record', async () => {
            genuineGooglebotDns();

            expect(
                await isVerifiedCrawler(`::ffff:${GOOGLE_IP}`, GOOGLEBOT_UA)
            ).toBe(true);
            expect(mockReverse).toHaveBeenCalledWith(GOOGLE_IP);
            expect(mockResolve4).toHaveBeenCalledWith(GOOGLE_HOST);
            expect(mockResolve6).not.toHaveBeenCalled();
        });

        it('does not let one crawler claim another crawler’s domain', async () => {
            genuineGooglebotDns();

            expect(await isVerifiedCrawler(GOOGLE_IP, BINGBOT_UA)).toBe(false);
        });

        it.each([
            [BINGBOT_UA, 'msnbot-157-55-33-18.search.msn.com', '157.55.33.18'],
            [YETI_UA, 'crawl.211-249-46-191.web.naver.com', '211.249.46.191'],
            [DAUMOA_UA, 'daumoa.crawl.kakao.com', '110.45.1.1'],
        ])('verifies %s via its crawl zone', async (ua, host, ip) => {
            mockReverse.mockResolvedValue([host]);
            mockResolve4.mockResolvedValue([ip]);

            expect(await isVerifiedCrawler(ip, ua)).toBe(true);
        });

        it.each([
            [YETI_UA, 'mail.naver.com'],
            [DAUMOA_UA, 'www.kakao.com'],
            [DAUMOA_UA, 'crawl.daum.net'],
        ])(
            'rejects %s from a host outside the crawl zone (%s)',
            async (ua, host) => {
                mockReverse.mockResolvedValue([host]);
                mockResolve4.mockResolvedValue(['198.51.100.7']);

                expect(await isVerifiedCrawler('198.51.100.7', ua)).toBe(false);
                expect(mockResolve4).not.toHaveBeenCalled();
            }
        );

        it('verifies IPv6 crawlers with resolve6, comparing canonical forms', async () => {
            mockReverse.mockResolvedValue([
                'crawl-2001-4860-4801-10--1.googlebot.com',
            ]);
            mockResolve6.mockResolvedValue(['2001:4860:4801:0010:0000::0001']);

            expect(
                await isVerifiedCrawler('2001:4860:4801:10::1', GOOGLEBOT_UA)
            ).toBe(true);
            expect(mockResolve4).not.toHaveBeenCalled();
        });
    });

    describe('failure handling', () => {
        it('returns false at the timeout and lets the late result serve the next request', async () => {
            vi.useFakeTimers();
            let finishReverse: (hosts: string[]) => void = () => {};
            mockReverse.mockReturnValue(
                new Promise<string[]>(resolve => {
                    finishReverse = resolve;
                })
            );
            mockResolve4.mockResolvedValue([GOOGLE_IP]);

            const first = isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA);
            await vi.advanceTimersByTimeAsync(VERIFY_TIMEOUT_MS);
            expect(await first).toBe(false);

            finishReverse([GOOGLE_HOST]);
            await vi.advanceTimersByTimeAsync(0);

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(true);
            expect(mockReverse).toHaveBeenCalledOnce();
        });

        it('a transient DNS error returns false, is not written to Redis, and is retried after a minute', async () => {
            vi.useFakeTimers();
            mockReverse.mockRejectedValueOnce(dnsError('ESERVFAIL'));

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(
                false
            );
            expect(store.size).toBe(0);

            // 잠깐은 기억한다 — 장애 중 같은 IP가 DNS를 다시 두드리지 않는다.
            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockReverse).toHaveBeenCalledOnce();

            vi.advanceTimersByTime(60_001);
            genuineGooglebotDns();
            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(true);
            expect(mockReverse).toHaveBeenCalledTimes(2);
        });

        it('a forward-lookup failure that is not "no record" is transient, not a rejection', async () => {
            mockReverse.mockResolvedValue([GOOGLE_HOST]);
            mockResolve4.mockRejectedValue(dnsError('ETIMEOUT'));

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(
                false
            );
            expect(store.size).toBe(0);
        });

        it('still verifies when Redis is not configured', async () => {
            vi.mocked(getRedisClient).mockReturnValue(null);
            genuineGooglebotDns();

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(true);
        });

        it('falls through to DNS when the Redis read fails', async () => {
            mockGet.mockRejectedValueOnce(new Error('upstash down'));
            genuineGooglebotDns();

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(true);
        });
    });

    describe('caching', () => {
        it('serves a repeat request from memory without DNS or Redis', async () => {
            genuineGooglebotDns();
            await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA);
            mockGet.mockClear();

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(true);
            expect(mockReverse).toHaveBeenCalledOnce();
            expect(mockGet).not.toHaveBeenCalled();
        });

        it('serves a verdict another instance stored in Redis without DNS (Upstash numeric deserialization)', async () => {
            genuineGooglebotDns();
            await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA);
            const [key] = [...store.keys()];
            // 다른 인스턴스 흉내: 메모리를 비우고, Upstash가 '1'을 1로 돌려주는 경우.
            __resetVerifiedCrawlerForTests();
            store.set(key, { value: 1, ex: VERIFIED_TTL_SECONDS });
            mockReverse.mockClear();

            expect(await isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA)).toBe(true);
            expect(mockReverse).not.toHaveBeenCalled();
        });

        it('remembers a rejection in memory only, for an hour', async () => {
            vi.useFakeTimers();
            mockReverse.mockResolvedValue(['host.attacker.example']);
            await isVerifiedCrawler('198.51.100.7', GOOGLEBOT_UA);

            vi.advanceTimersByTime(REJECTED_MEMORY_TTL_MS - 1);
            expect(await isVerifiedCrawler('198.51.100.7', GOOGLEBOT_UA)).toBe(
                false
            );
            expect(mockReverse).toHaveBeenCalledOnce();

            vi.advanceTimersByTime(2);
            await isVerifiedCrawler('198.51.100.7', GOOGLEBOT_UA);
            expect(mockReverse).toHaveBeenCalledTimes(2);
            expect(store.size).toBe(0);
        });

        it(`caps concurrent verifications at ${MAX_IN_FLIGHT_VERIFICATIONS}: new IPs above it do no I/O`, async () => {
            vi.useFakeTimers();
            // 끝나지 않는 PTR — 진행 중 검증이 칸을 계속 잡고 있게 한다.
            mockReverse.mockReturnValue(new Promise<string[]>(() => {}));
            const ipAt = (i: number): string =>
                `198.51.${100 + (i >> 8)}.${i & 255}`;

            const pending = Array.from(
                { length: MAX_IN_FLIGHT_VERIFICATIONS },
                (_, i) => isVerifiedCrawler(ipAt(i), GOOGLEBOT_UA)
            );
            await vi.advanceTimersByTimeAsync(0);
            const readsAtCap = mockGet.mock.calls.length;

            expect(
                await isVerifiedCrawler(
                    ipAt(MAX_IN_FLIGHT_VERIFICATIONS),
                    GOOGLEBOT_UA
                )
            ).toBe(false);
            expect(mockGet.mock.calls.length).toBe(readsAtCap);
            expect(mockReverse).toHaveBeenCalledTimes(
                MAX_IN_FLIGHT_VERIFICATIONS
            );

            await vi.advanceTimersByTimeAsync(VERIFY_TIMEOUT_MS);
            expect(await Promise.all(pending)).toEqual(
                Array(MAX_IN_FLIGHT_VERIFICATIONS).fill(false)
            );
        });

        it('concurrent requests from one IP share a single verification', async () => {
            genuineGooglebotDns();

            const verdicts = await Promise.all([
                isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA),
                isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA),
                isVerifiedCrawler(GOOGLE_IP, GOOGLEBOT_UA),
            ]);

            expect(verdicts).toEqual([true, true, true]);
            expect(mockReverse).toHaveBeenCalledOnce();
        });
    });
});

describe('claimedCrawler', () => {
    it.each([
        [GOOGLEBOT_UA, 'google'],
        ['Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)', 'google'],
        ['Googlebot-Image/1.0', 'google'],
        [BINGBOT_UA, 'bing'],
        [YETI_UA, 'naver'],
        [DAUMOA_UA, 'daum'],
    ])('%s → %s', (ua, id) => {
        expect(claimedCrawler(ua)?.id).toBe(id);
    });

    it.each([[CHROME_UA], ['curl/8.4.0'], [''], [null]])(
        'claims nothing for %s',
        ua => {
            expect(claimedCrawler(ua)).toBeNull();
        }
    );
});

describe('canonicalIp', () => {
    it.each([
        ['66.249.66.1', '66.249.66.1'],
        [' 66.249.66.1 ', '66.249.66.1'],
        ['::ffff:66.249.66.1', '66.249.66.1'],
        ['2001:4860:4801:0010:0000:0000:0000:0001', '2001:4860:4801:10::1'],
        ['2001:DB8::1', '2001:db8::1'],
    ])('%s → %s', (raw, expected) => {
        expect(canonicalIp(raw)).toBe(expected);
    });

    it.each([['unknown'], [''], ['not-an-ip'], ['999.1.1.1']])(
        '%s → null',
        raw => {
            expect(canonicalIp(raw)).toBeNull();
        }
    );
});
