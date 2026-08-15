vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache');

const { mockFetchDailyCloses } = vi.hoisted(() => ({
    mockFetchDailyCloses: vi.fn(),
}));

// lookbackStartDate는 실제 구현을 그대로 쓰고, fetchDailyCloses만 대체한다 — 그래야
// buildMarketFearGreedView가 계산하는 `from` 값이 실제 로직으로 검증된다.
vi.mock('@/entities/market-fear-greed/lib/fetchDailyCloses', async () => ({
    ...(await vi.importActual(
        '@/entities/market-fear-greed/lib/fetchDailyCloses'
    )),
    fetchDailyCloses: mockFetchDailyCloses,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    getCachedMarketFearGreed,
    MARKET_FEAR_GREED_CONFIG_FINGERPRINT,
} from '@/entities/market-fear-greed/api/marketFearGreedCache';
// `lastPublishedSessionDate`는 위 vi.mock에서 실제 구현이 그대로 재수출되므로,
// 여기서 import한 것과 buildMarketFearGreedView 내부가 계산하는 `to`는 같은 함수다.
import { lastPublishedSessionDate } from '@/entities/market-fear-greed/lib/fetchDailyCloses';
import { MARKET_FEAR_GREED_SYMBOLS } from '@/entities/market-fear-greed/lib/marketFearGreedSymbols';
import type { MarketFearGreedView } from '@/entities/market-fear-greed/model';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

const mockGetOrSetCache = vi.mocked(getOrSetCache);

const SAMPLE_SNAPSHOT: NonNullable<MarketFearGreedView['snapshot']> = {
    score: 62,
    label: 'GREED',
    factors: [],
    confidence: 'normal',
    sampleSize: 200,
    asOf: '2026-08-14',
};

describe('getCachedMarketFearGreed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchDailyCloses.mockResolvedValue([]);
        // getOrSetCache는 fetcher를 즉시 호출해 그 결과를 그대로 반환(단위테스트용 통과).
        mockGetOrSetCache.mockImplementation(async (_key, _ttl, fetcher) =>
            fetcher()
        );
    });

    it('Redis 키가 market:fear-greed:로 시작하고 설정 fingerprint를 포함한다', async () => {
        await getCachedMarketFearGreed();

        const [key] = mockGetOrSetCache.mock.calls[0]!;
        expect(key).toMatch(/^market:fear-greed:[a-f0-9]{12}$/);
        expect(key).toBe(
            `market:fear-greed:${MARKET_FEAR_GREED_CONFIG_FINGERPRINT}`
        );
    });

    it('TTL로 고정 SECONDS_PER_HOUR(3600)를 전달한다(세션 의존 정책 아님)', async () => {
        await getCachedMarketFearGreed();

        const [, ttl] = mockGetOrSetCache.mock.calls[0]!;
        expect(ttl).toBe(SECONDS_PER_HOUR);
        expect(ttl).toBe(3600);
    });

    it('6개 시리즈 전부를 동일한 from으로 fetchDailyCloses에 요청한다', async () => {
        await getCachedMarketFearGreed();

        expect(mockFetchDailyCloses).toHaveBeenCalledTimes(6);

        const calls = mockFetchDailyCloses.mock.calls as [
            string,
            string,
            string,
        ][];
        const froms = calls.map(([, from]) => from);
        expect(new Set(froms).size).toBe(1);

        const requestedSymbols = calls.map(([symbol]) => symbol).sort();
        expect(requestedSymbols).toEqual(
            Object.values(MARKET_FEAR_GREED_SYMBOLS).sort()
        );
    });

    it('6개 시리즈 전부가 동일한 to를 받고, 그 to는 오늘보다 늦지 않다', async () => {
        // 마감+발행버퍼 이후 평일로 시각을 고정 — 실제 clock 대신 결정적 시각으로
        // buildMarketFearGreedView가 계산하는 `to`를 재현한다.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-14T00:30:00Z'));
        try {
            await getCachedMarketFearGreed();

            const calls = mockFetchDailyCloses.mock.calls as [
                string,
                string,
                string,
            ][];
            const tos = calls.map(([, , to]) => to);
            expect(tos).toHaveLength(6);
            expect(new Set(tos).size).toBe(1);

            const expectedTo = lastPublishedSessionDate(new Date());
            expect(tos[0]).toBe(expectedTo);
            // 오늘(고정 시각 기준 ISO 날짜)보다 늦지 않다 — ISO 8601 문자열은
            // 사전식 비교가 곧 날짜 비교와 일치한다.
            expect(tos[0]! <= '2026-07-14').toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('shouldCache: snapshot이 null이면 false, snapshot이 있으면 true', async () => {
        await getCachedMarketFearGreed();

        const [, , , shouldCache] = mockGetOrSetCache.mock.calls[0]!;
        expect(typeof shouldCache).toBe('function');

        const nullView: MarketFearGreedView = {
            snapshot: null,
            comparisons: [],
        };
        expect(shouldCache!(nullView)).toBe(false);

        const withSnapshot: MarketFearGreedView = {
            snapshot: SAMPLE_SNAPSHOT,
            comparisons: [],
        };
        expect(shouldCache!(withSnapshot)).toBe(true);
    });

    it('fetchDailyCloses가 reject하면 흡수하지 않고 그대로 전파한다', async () => {
        mockFetchDailyCloses.mockRejectedValue(new Error('FMP down'));

        await expect(getCachedMarketFearGreed()).rejects.toThrow('FMP down');
    });
});

/**
 * entity ↔ core 배선 통합 검증.
 *
 * 위 단위 테스트들은 전 시리즈를 빈 배열로 스텁하므로, core가 어떤 입력을 받든
 * `null`을 돌려줘 배선 오류가 드러나지 않는다. 실제 길이의 합성 종가를 흘려보내
 * "의미론적 키로 매핑됐는가 / 스냅샷과 비교 지점이 실제로 나오는가"를 못박는다.
 * 티커 문자열을 키로 잘못 매핑하거나 두 core 함수를 바꿔 끼우면 여기서 깨진다.
 */
describe('entity ↔ core 배선 (실제 core 계산)', () => {
    /** 결정적 LCG — 테스트는 Math.random에 의존하지 않는다. */
    function lcg(seed: number): () => number {
        let state = seed;
        return () => {
            state = (state * 1103515245 + 12345) % 2147483648;
            return state / 2147483648;
        };
    }

    function walk(seed: number) {
        const next = lcg(seed);
        let close = 100;
        return Array.from({ length: 300 }, (_, i) => {
            close *= 1 + (next() - 0.5) * 0.04;
            return {
                date: new Date(Date.UTC(2024, 0, 1) + i * 86_400_000)
                    .toISOString()
                    .slice(0, 10),
                close,
            };
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOrSetCache.mockImplementation(async (_key, _ttl, fetcher) =>
            fetcher()
        );
        // 시리즈마다 다른 seed — 전부 같으면 수익률 차 팩터가 전부 0이 되어
        // 백분위가 퇴화하고, 배선이 틀려도 우연히 통과할 수 있다.
        let seed = 11;
        mockFetchDailyCloses.mockImplementation(async () => walk((seed += 97)));
    });

    it('실제 core 계산을 거쳐 5개 팩터를 가진 스냅샷을 만든다', async () => {
        const view = await getCachedMarketFearGreed();

        expect(view.snapshot).not.toBeNull();
        expect(view.snapshot?.factors.map(f => f.key)).toEqual([
            'momentum',
            'volatility',
            'safe_haven',
            'junk_bond',
            'breadth',
        ]);
        expect(view.snapshot?.score).toBeGreaterThanOrEqual(0);
        expect(view.snapshot?.score).toBeLessThanOrEqual(100);
        expect(view.snapshot?.confidence).toBe('normal');
        // 300세션 모두 공통 날짜이므로 asOf는 마지막 세션이다.
        expect(view.snapshot?.asOf).toBe('2024-10-26');
    });

    it('기간별 비교 4지점을 순서대로 만든다', async () => {
        const view = await getCachedMarketFearGreed();

        expect(view.comparisons.map(c => c.key)).toEqual([
            'now',
            '1w',
            '1m',
            '1y',
        ]);
        expect(view.comparisons[0].date).toBe(view.snapshot?.asOf);
        expect(view.comparisons[0].score).toBeCloseTo(
            view.snapshot?.score as number,
            10
        );
    });

    it('한 시리즈라도 비면 공통 세션이 사라져 스냅샷이 null이 된다', async () => {
        let call = 0;
        mockFetchDailyCloses.mockImplementation(async () =>
            call++ === 0 ? [] : walk(31)
        );

        const view = await getCachedMarketFearGreed();

        expect(view.snapshot).toBeNull();
        expect(view.comparisons).toEqual([]);
    });
});
