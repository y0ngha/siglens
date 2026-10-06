vi.mock('server-only', () => ({}));

const { mockUs, mockKr, mockCrypto, mockPin, cacheStore, cacheCalls } =
    vi.hoisted(() => ({
        mockUs: vi.fn(),
        mockPin: vi.fn(async () => undefined),
        mockKr: vi.fn(),
        mockCrypto: vi.fn(),
        // `unstable_cache`의 저장 의미론만 흉내 낸다: 키가 있으면 그 값, 없으면 콜백을 돌려
        // **던지지 않았을 때만** 저장한다.
        cacheStore: new Map<string, unknown>(),
        cacheCalls: [] as {
            keyParts: string[];
            options: { revalidate: number; tags: string[] };
        }[],
    }));

vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForIncompleteSession: mockPin,
}));

vi.mock('next/cache', () => ({
    unstable_cache:
        (
            fn: () => Promise<unknown>,
            keyParts: string[],
            options: { revalidate: number; tags: string[] }
        ) =>
        async () => {
            cacheCalls.push({ keyParts, options });
            const key = JSON.stringify(keyParts);
            if (cacheStore.has(key)) return cacheStore.get(key);
            const value = await fn();
            cacheStore.set(key, value);
            return value;
        },
}));

vi.mock('@/entities/market-fear-greed/api/marketFearGreedStaticCache', () => ({
    getMarketFearGreedStatic: mockUs,
}));
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
    () => ({
        getMarketFearGreedKrStatic: mockKr,
    })
);
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache',
    () => ({ getMarketFearGreedCryptoStatic: mockCrypto })
);

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getMarketFearGreedReading } from '@/entities/market-fear-greed/api/marketFearGreedReading';

function view(score: number, asOf: string) {
    return {
        snapshot: {
            score,
            label: 'NEUTRAL' as const,
            factors: [],
            confidence: 'normal' as const,
            sampleSize: 500,
            asOf,
        },
        comparisons: [],
    };
}

describe('getMarketFearGreedReading', () => {
    beforeEach(() => {
        // 2026-10-06(화) 12:00 UTC(= 21:00 KST) — 마지막 마감 세션은 미국 10-05(월, 오늘
        // 장은 아직), 한국 10-06(마감 + 버퍼 지남), 크립토는 UTC 어제(10-05).
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
        cacheStore.clear();
        cacheCalls.length = 0;
        mockUs.mockClear();
        mockPin.mockClear();
        mockUs.mockResolvedValue(view(46, '2026-10-05'));
        mockKr.mockResolvedValue(view(52, '2026-10-06'));
        mockCrypto.mockResolvedValue(view(30, '2026-10-05'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it.each([
        ['us-equity', { date: '2026-10-05', score: 46 }],
        ['kr-equity', { date: '2026-10-06', score: 52 }],
        ['crypto', { date: '2026-10-05', score: 30 }],
    ] as const)(
        '%s는 그 시장 허브와 같은 정적 캐시의 스냅샷을 날짜·점수로 돌려준다',
        async (profile, expected) => {
            const reading = await getMarketFearGreedReading(profile);

            expect(reading).toEqual({ ...expected, label: 'NEUTRAL' });
        }
    );

    it('스냅샷이 없으면 null이다', async () => {
        mockUs.mockResolvedValue({ snapshot: null, comparisons: [] });

        expect(await getMarketFearGreedReading('us-equity')).toBeNull();
    });

    it('조회가 실패하면 페이지를 죽이지 않고 null을 돌려준다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockKr.mockRejectedValue(new Error('upstream down'));

        expect(await getMarketFearGreedReading('kr-equity')).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[getMarketFearGreedReading]'),
            expect.any(Error)
        );
    });

    /**
     * clamp 회귀 가드. 이 판독은 24h를 선언한 종목 공포·탐욕 탭이 읽는다. 허브의 1h 정적
     * 캐시를 그대로 읽으면 Next 16.3이 그 탭을 1h로 clamp한다(2026-10 운영 실측:
     * `/AAPL/fear-greed` s-maxage 3600). 신선도는 세션 날짜 키가 책임진다.
     */
    it('세션 날짜를 키에 넣고 revalidate는 24h 이상이다 (1h 허브 캐시 clamp 회귀 가드)', async () => {
        await getMarketFearGreedReading('us-equity');

        expect(cacheCalls).toHaveLength(1);
        expect(cacheCalls[0]?.keyParts).toEqual([
            'market-fear-greed-reading-v1',
            'us-equity',
            '2026-10-05',
        ]);
        expect(cacheCalls[0]?.options.revalidate).toBeGreaterThanOrEqual(
            86_400
        );
        expect(cacheCalls[0]?.options.tags).toEqual(['market:fear-greed']);
    });

    it('시장마다 그 시장의 세션 달력으로 키를 만든다', async () => {
        await getMarketFearGreedReading('kr-equity');
        await getMarketFearGreedReading('crypto');

        expect(cacheCalls.map(c => c.keyParts.at(-1))).toEqual([
            '2026-10-06',
            '2026-10-05',
        ]);
        expect(cacheCalls.map(c => c.options.tags)).toEqual([
            ['market:fear-greed:kr'],
            ['market:fear-greed:crypto'],
        ]);
    });

    it('같은 세션의 다음 렌더는 저장된 판독을 읽는다', async () => {
        await getMarketFearGreedReading('us-equity');
        mockUs.mockResolvedValue(view(99, '2026-10-05'));

        expect(await getMarketFearGreedReading('us-equity')).toEqual({
            date: '2026-10-05',
            score: 46,
            label: 'NEUTRAL',
        });
        expect(mockUs).toHaveBeenCalledTimes(1);
    });

    it('세션이 넘어가면 새 키라 새 판독을 읽는다', async () => {
        await getMarketFearGreedReading('us-equity');
        // 2026-10-07 12:00 UTC — 10-06 세션이 마감 + 버퍼를 지났다.
        vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
        mockUs.mockResolvedValue(view(60, '2026-10-06'));

        expect(await getMarketFearGreedReading('us-equity')).toEqual({
            date: '2026-10-06',
            score: 60,
            label: 'NEUTRAL',
        });
    });

    it('갱신을 마친 허브의 asOf는 키의 세션과 같다 → 저장하고 핀을 걸지 않는다', async () => {
        await getMarketFearGreedReading('us-equity');

        expect(cacheStore.size).toBe(1);
        expect(mockPin).not.toHaveBeenCalled();
    });

    it('판독이 직전 거래일이면(허브 Redis 1h 창·발행 지연) 이번 렌더에만 쓰고 저장하지 않으며 revalidate를 1h로 낮춘다', async () => {
        // 키 10-05(월)의 직전 거래일은 10-02(금).
        mockUs.mockResolvedValue(view(40, '2026-10-02'));

        expect(await getMarketFearGreedReading('us-equity')).toEqual({
            date: '2026-10-02',
            score: 40,
            label: 'NEUTRAL',
        });
        expect(cacheStore.size).toBe(0);
        expect(mockPin).toHaveBeenCalledTimes(1);

        mockUs.mockResolvedValue(view(46, '2026-10-05'));
        expect((await getMarketFearGreedReading('us-equity'))?.score).toBe(46);
        expect(cacheStore.size).toBe(1);
    });

    it('판독이 직전 거래일보다도 오래됐으면(허브 시리즈 장기 장애) 저장한다 — 매 렌더 허브를 다시 계산하지 않게', async () => {
        mockUs.mockResolvedValue(view(40, '2026-09-25'));

        await getMarketFearGreedReading('us-equity');
        await getMarketFearGreedReading('us-equity');

        expect(mockUs).toHaveBeenCalledTimes(1);
        expect(mockPin).not.toHaveBeenCalled();
    });

    it('스냅샷이 없는 결과도 저장하지 않고 1h 핀을 건다', async () => {
        mockUs.mockResolvedValue({ snapshot: null, comparisons: [] });

        expect(await getMarketFearGreedReading('us-equity')).toBeNull();
        expect(cacheStore.size).toBe(0);
        expect(mockPin).toHaveBeenCalledTimes(1);
    });
});
